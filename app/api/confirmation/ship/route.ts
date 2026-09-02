import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { createJTOrder } from "@/lib/jt/client";

export async function POST(req: NextRequest) {
  const { orders } = await req.json();
  if (!orders?.length)
    return NextResponse.json({ error: "No orders provided" }, { status: 400 });

  const results = [];

  for (const o of orders) {
    // Fetch full order from Shopify to get address + items
    const shopifyOrder = await fetchShopifyOrder(o.shopify_order_id);

    const jtResult = await createJTOrder({
      orderNumber:  o.order_number,
      customerName: o.customer_name,
      phone:        o.phone,
      address:      shopifyOrder?.address1 ?? o.address ?? "",
      city:         shopifyOrder?.city     ?? o.city     ?? "",
      governorate:  shopifyOrder?.province ?? o.governorate ?? "",
      items:        shopifyOrder?.items    ?? [{ name: "منتج", qty: 1 }],
      totalAmount:  shopifyOrder?.total    ?? o.total    ?? 0,
    });

    // Save shipment record
    await supabaseAdmin.from("shipments").upsert({
      shopify_order_id: o.shopify_order_id,
      order_number:     o.order_number,
      customer_name:    o.customer_name,
      phone:            o.phone,
      provider:         "J&T Express",
      status:           jtResult.ok && jtResult.trackingNumber ? "shipped" : "pending",
      tracking_number:  jtResult.trackingNumber ?? null,
    }, { onConflict: "shopify_order_id" });

    // If we got a tracking number, send WhatsApp message
    if (jtResult.ok && jtResult.trackingNumber) {
      await sendTrackingWA(o.phone, o.customer_name, jtResult.trackingNumber);
    }

    results.push({
      order_number:   o.order_number,
      ok:             jtResult.ok,
      trackingNumber: jtResult.trackingNumber,
      error:          jtResult.error,
    });
  }

  await supabaseAdmin.from("activity_log").insert({
    type:      "shipment",
    action:    "bulk_create",
    detail:    `J&T: ${results.filter(r => r.ok).length} شُحن، ${results.filter(r => !r.ok).length} فشل`,
    user_name: "النظام",
    metadata:  { results },
  });

  return NextResponse.json({
    ok:     true,
    count:  results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchShopifyOrder(shopifyOrderId: number) {
  const shop  = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !token) return null;

  try {
    const res  = await fetch(
      `https://${shop}/admin/api/2024-01/orders/${shopifyOrderId}.json?fields=id,order_number,total_price,shipping_address,line_items`,
      { headers: { "X-Shopify-Access-Token": token } }
    );
    const data = await res.json();
    const ord  = data?.order;
    if (!ord) return null;

    const addr = ord.shipping_address;
    return {
      address1: addr?.address1 ?? "",
      city:     addr?.city     ?? "",
      province: addr?.province ?? addr?.city ?? "",
      total:    parseFloat(ord.total_price ?? "0"),
      items:    (ord.line_items ?? []).map((li: { title: string; quantity: number }) => ({
        name: li.title,
        qty:  li.quantity,
      })),
    };
  } catch (e) {
    console.error("[ship] Shopify fetch error:", e);
    return null;
  }
}

async function sendTrackingWA(phone: string, customerName: string, trackingNumber: string) {
  const waUrl    = process.env.WA_SERVICE_URL;
  const waSecret = process.env.WA_SECRET;
  if (!waUrl || !waSecret) return;

  try {
    await fetch(`${waUrl}/send-tracking`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-wa-secret": waSecret },
      body:    JSON.stringify({ phone, customer_name: customerName, tracking_number: trackingNumber }),
    });
  } catch (e) {
    console.error("[ship] WA tracking send error:", e);
  }
}
