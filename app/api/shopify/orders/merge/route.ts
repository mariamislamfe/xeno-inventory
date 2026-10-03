import { NextRequest, NextResponse } from "next/server";
import { normalizeOrder } from "@/lib/shopify/orders";
import type { ShopifyOrderRaw } from "@/lib/shopify/orders";

const SHOP    = process.env.SHOPIFY_SHOP!;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN!;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

function h() { return { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" }; }

async function getOrder(id: number): Promise<ShopifyOrderRaw | null> {
  const r = await fetch(`https://${SHOP}/admin/api/${VERSION}/orders/${id}.json`, { headers: h() });
  if (!r.ok) return null;
  const d = await r.json() as { order: ShopifyOrderRaw };
  return d.order;
}

async function cancelOrder(id: number) {
  await fetch(`https://${SHOP}/admin/api/${VERSION}/orders/${id}/cancel.json`, {
    method: "POST", headers: h(), body: JSON.stringify({}),
  });
}

// POST /api/shopify/orders/merge
// Body: { shopifyIds: number[] }  — must be 2+ unfulfilled orders from same customer
export async function POST(req: NextRequest) {
  try {
    const { shopifyIds } = await req.json() as { shopifyIds: number[] };
    if (!shopifyIds || shopifyIds.length < 2) {
      return NextResponse.json({ error: "يلزم طلبان على الأقل" }, { status: 400 });
    }

    // Fetch full order details for all
    const orders = (await Promise.all(shopifyIds.map(getOrder))).filter(Boolean) as ShopifyOrderRaw[];
    if (orders.length < 2) {
      return NextResponse.json({ error: "تعذر جلب الطلبات من Shopify" }, { status: 422 });
    }

    // Guard: all must be unfulfilled
    const anyFulfilled = orders.some(o => o.fulfillment_status === "fulfilled" || o.cancelled_at);
    if (anyFulfilled) {
      return NextResponse.json({ error: "لا يمكن دمج طلب مكتمل أو ملغي" }, { status: 422 });
    }

    // Merge line items: sum quantities for same variant_id, append distinct ones
    const mergedItems = new Map<string, { variantId?: number; title: string; quantity: number; price: string }>();
    for (const order of orders) {
      for (const li of order.line_items) {
        const key = li.variant_id ? String(li.variant_id) : `custom_${li.title}`;
        if (mergedItems.has(key)) {
          mergedItems.get(key)!.quantity += li.quantity;
        } else {
          mergedItems.set(key, {
            variantId: li.variant_id || undefined,
            title:     li.title,
            quantity:  li.quantity,
            price:     li.price,
          });
        }
      }
    }

    const lineItems = [...mergedItems.values()].map(i => ({
      ...(i.variantId ? { variant_id: i.variantId } : { title: i.title }),
      quantity: i.quantity,
      price:    i.price,
    }));

    // Use first order's customer & address
    const base    = orders[0];
    const addr    = base.shipping_address ?? base.billing_address;
    const digits  = (base.phone ?? addr?.phone ?? "").replace(/[^0-9]/g, "");
    const phone   = digits ? (digits.startsWith("0") ? `+20${digits.slice(1)}` : `+${digits}`) : undefined;

    const addrBlock = addr ? {
      first_name:   addr.first_name,
      last_name:    addr.last_name || addr.first_name,
      phone:        phone ?? addr.phone ?? "",
      address1:     addr.address1,
      city:         addr.city,
      province:     addr.province,
      country:      "Egypt",
      country_code: "EG",
    } : undefined;

    // Combine notes from all orders
    const notes = orders.map(o => o.note).filter(Boolean).join(" | ");

    // Combine tags
    const tags = [...new Set(
      orders.flatMap(o => o.tags ? o.tags.split(",").map(t => t.trim()) : [])
    )].filter(Boolean).join(",");

    const newOrderPayload = {
      email:            base.email,
      financial_status: "pending",
      send_receipt:     false,
      send_fulfillment_receipt: false,
      note:             notes || undefined,
      tags:             tags ? `${tags},xeno_merged` : "xeno_merged",
      ...(base.customer?.id ? { customer: { id: base.customer.id } } : {}),
      ...(addrBlock ? { shipping_address: addrBlock, billing_address: addrBlock } : {}),
      line_items: lineItems,
    };

    // Create merged order
    const createResp = await fetch(`https://${SHOP}/admin/api/${VERSION}/orders.json`, {
      method: "POST",
      headers: h(),
      body: JSON.stringify({ order: newOrderPayload }),
    });

    if (!createResp.ok) {
      const txt = await createResp.text();
      return NextResponse.json({ error: txt }, { status: createResp.status });
    }

    const created = await createResp.json() as { order: ShopifyOrderRaw };

    // Cancel original orders
    await Promise.all(shopifyIds.map(cancelOrder));

    return NextResponse.json({ ok: true, order: normalizeOrder(created.order) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
