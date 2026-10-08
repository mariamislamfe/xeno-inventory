import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { createJTOrder } from "@/lib/jt/client";
import { saveShipment } from "@/lib/shipments";
import { currentQty, orderTotal } from "@/lib/shopify/orders";

export async function POST(req: NextRequest) {
  const { orders } = await req.json();
  if (!orders?.length)
    return NextResponse.json({ error: "No orders provided" }, { status: 400 });

  const results = [];

  for (const o of orders) {
    // FIX-4: Check for existing shipment with a tracking number — prevents double-shipping
    const { data: existing } = await supabaseAdmin
      .from("shipments")
      .select("tracking_number, status")
      .eq("shopify_order_id", o.shopify_order_id)
      .not("tracking_number", "is", null)
      .maybeSingle();

    if (existing?.tracking_number) {
      results.push({
        order_number:   o.order_number,
        ok:             true,
        trackingNumber: existing.tracking_number,
        error:          undefined,
        skipped:        true,
      });
      continue;
    }

    // Shipped before but the shipments row never got saved — recover the tracking
    // number from the activity log instead of creating a second J&T order
    const { data: logged } = await supabaseAdmin
      .from("activity_log")
      .select("metadata")
      .eq("type", "shipment")
      .contains("metadata", { results: [{ order_number: o.order_number, ok: true }] })
      .order("created_at", { ascending: false })
      .limit(1);
    const prevTracking = (logged?.[0]?.metadata as { results?: { order_number: string; trackingNumber?: string }[] } | undefined)
      ?.results?.find((r) => r.order_number === o.order_number && r.trackingNumber)?.trackingNumber;

    if (prevTracking) {
      await saveShipment({
        shopify_order_id: Number(o.shopify_order_id),
        order_number:     o.order_number,
        customer_name:    o.customer_name,
        phone:            o.phone,
        provider:         "J&T Express",
        status:           "picked_up",
        tracking_number:  prevTracking,
      });
      results.push({
        order_number:   o.order_number,
        ok:             true,
        trackingNumber: prevTracking,
        error:          undefined,
        skipped:        true,
      });
      continue;
    }

    // FIX-2: Fetch full order from Shopify to get FRESH address, phone, name, and items
    const shopifyOrder = await fetchShopifyOrder(o.shopify_order_id);

    // FIX-5: Check xeno_ops for items_override (employee-edited items)
    const { data: xenoOp } = await supabaseAdmin
      .from("xeno_ops")
      .select("items_override")
      .eq("shopify_order_id", o.shopify_order_id)
      .maybeSingle();

    const itemsToShip = xenoOp?.items_override
      ?? shopifyOrder?.items
      ?? [{ name: "منتج", qty: 1 }];

    const jtResult = await createJTOrder({
      orderNumber:  o.order_number,
      // FIX-2: Use fresh Shopify data for customer name and phone
      customerName: shopifyOrder?.customerName ?? o.customer_name,
      phone:        shopifyOrder?.phone        ?? o.phone,
      address:      shopifyOrder?.address1     ?? o.address     ?? "",
      city:         shopifyOrder?.city         ?? o.city        ?? "",
      governorate:  shopifyOrder?.province     ?? o.governorate ?? "",
      items:        itemsToShip,
      totalAmount:  shopifyOrder?.total        ?? o.total       ?? 0,
      note:         shopifyOrder?.note,
    });

    // Save shipment record so the tracking number shows in the orders list
    const saveErr = await saveShipment({
      shopify_order_id: Number(o.shopify_order_id),
      order_number:     o.order_number,
      customer_name:    shopifyOrder?.customerName ?? o.customer_name,
      phone:            shopifyOrder?.phone        ?? o.phone,
      provider:         "J&T Express",
      status:           jtResult.ok && jtResult.trackingNumber ? "picked_up" : "pending",
      tracking_number:  jtResult.trackingNumber ?? null,
    });
    if (saveErr) console.error("[ship] shipments save error:", o.order_number, saveErr);

    // If we got a tracking number, send WhatsApp message
    if (jtResult.ok && jtResult.trackingNumber) {
      await sendTrackingWA(
        shopifyOrder?.phone ?? o.phone,
        shopifyOrder?.customerName ?? o.customer_name,
        jtResult.trackingNumber,
      );
    }

    results.push({
      order_number:   o.order_number,
      ok:             jtResult.ok,
      trackingNumber: jtResult.trackingNumber,
      error:          jtResult.error,
      saveError:      saveErr ?? undefined,
      skipped:        false,
    });
  }

  await supabaseAdmin.from("activity_log").insert({
    type:      "shipment",
    action:    "bulk_create",
    detail:    `J&T: ${results.filter(r => r.ok).length} شُحن، ${results.filter(r => !r.ok && !r.skipped).length} فشل`,
    user_name: "النظام",
    metadata:  { results },
  });

  const successCount = results.filter(r => r.ok).length;
  return NextResponse.json({
    ok:     successCount > 0,
    count:  successCount,
    failed: results.filter(r => !r.ok && !r.skipped).length,
    results,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchShopifyOrder(shopifyOrderId: number) {
  const shop    = process.env.SHOPIFY_SHOP;
  const token   = process.env.SHOPIFY_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";
  if (!shop || !token) return null;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 10_000);

  try {
    const res  = await fetch(
      `https://${shop}/admin/api/${version}/orders/${shopifyOrderId}.json?fields=id,order_number,total_price,current_total_price,note,shipping_address,line_items`,
      { headers: { "X-Shopify-Access-Token": token }, cache: "no-store", signal: controller.signal }
    );
    clearTimeout(timer);
    const data = await res.json();
    const ord  = data?.order;
    if (!ord) return null;

    const addr = ord.shipping_address;
    // FIX-2: Include phone and customer name from shipping address
    const firstName = addr?.first_name ?? "";
    const lastName  = addr?.last_name  ?? "";

    return {
      address1:     addr?.address1 ?? "",
      city:         addr?.city     ?? "",
      province:     addr?.province ?? addr?.city ?? "",
      phone:        addr?.phone    ?? "",
      customerName: `${firstName} ${lastName}`.trim() || "",
      total:        orderTotal(ord),   // after edits, not the original total
      note:         (ord.note as string | null) ?? "",
      items:        (ord.line_items ?? [])
        .filter((li: { quantity: number; current_quantity?: number }) => currentQty(li) > 0)
        .map((li: { title: string; quantity: number; current_quantity?: number; sku?: string | null; variant_title?: string | null }) => ({
        name:    li.title,
        qty:     currentQty(li),
        sku:     li.sku ?? "",
        variant: li.variant_title ?? "",
      })),
    };
  } catch (e) {
    clearTimeout(timer);
    console.error("[ship] Shopify fetch error:", e);
    return null;
  }
}

async function sendTrackingWA(phone: string, customerName: string, trackingNumber: string) {
  const waUrl    = process.env.WA_SERVICE_URL;
  const waSecret = process.env.WA_SECRET;
  if (!waUrl || !waSecret) return;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 8_000);

  try {
    await fetch(`${waUrl}/send-tracking`, {
      method:  "POST",
      signal:  controller.signal,
      headers: { "Content-Type": "application/json", "x-wa-secret": waSecret },
      body:    JSON.stringify({ phone, customer_name: customerName, tracking_number: trackingNumber }),
    });
  } catch (e) {
    console.error("[ship] WA tracking send error:", e);
  } finally {
    clearTimeout(timer);
  }
}
