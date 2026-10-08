import { NextRequest, NextResponse } from "next/server";
import { normalizeOrder } from "@/lib/shopify/orders";
import type { ShopifyOrderRaw } from "@/lib/shopify/orders";
import { toE164 } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/client";
import { isStatusTag } from "@/lib/order-status";

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

// The merged order replaces the originals, so remove them from Shopify entirely.
// Shopify only deletes cancelled orders, so cancel first.
async function removeOrder(id: number): Promise<boolean> {
  await fetch(`https://${SHOP}/admin/api/${VERSION}/orders/${id}/cancel.json`, {
    method: "POST", headers: h(), body: JSON.stringify({}),
  });
  const r = await fetch(`https://${SHOP}/admin/api/${VERSION}/orders/${id}.json`, {
    method: "DELETE", headers: h(),
  });
  return r.ok;
}

// POST /api/shopify/orders/merge
// Body: { shopifyIds: number[] }  — must be 2+ unfulfilled orders from same customer
// ── Merge lock ───────────────────────────────────────────────────────────────
// Several dashboards can try to auto-merge the same duplicates at once, which would
// create two merged orders. Each original is claimed with a row in xeno_ops
// (UNIQUE shopify_order_id) keyed by the negated order id: one multi-row insert,
// so it either claims every original or fails as a whole.
const LOCK_STATUS = "merge_lock";
const LOCK_TTL_MS = 2 * 60 * 1000;   // a crashed merge frees its originals after 2 min

function lockRows(ids: number[]) {
  return ids.map((id) => ({ shopify_order_id: -id, order_number: `merge-lock ${id}`, op_status: LOCK_STATUS }));
}

async function acquireMergeLock(ids: number[]): Promise<boolean> {
  const first = await supabaseAdmin.from("xeno_ops").insert(lockRows(ids));
  if (!first.error) return true;
  if (first.error.code !== "23505") throw new Error(`merge lock: ${first.error.message}`);
  // Taken: clear locks left by a merge that died, then try once more
  await supabaseAdmin.from("xeno_ops")
    .delete()
    .in("shopify_order_id", ids.map((id) => -id))
    .eq("op_status", LOCK_STATUS)
    .lt("created_at", new Date(Date.now() - LOCK_TTL_MS).toISOString());
  const retry = await supabaseAdmin.from("xeno_ops").insert(lockRows(ids));
  return !retry.error;
}

async function releaseMergeLock(ids: number[]) {
  await supabaseAdmin.from("xeno_ops")
    .delete()
    .in("shopify_order_id", ids.map((id) => -id))
    .eq("op_status", LOCK_STATUS);
}

export async function POST(req: NextRequest) {
  let shopifyIds: number[];
  try {
    ({ shopifyIds } = await req.json() as { shopifyIds: number[] });
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  if (!Array.isArray(shopifyIds) || shopifyIds.length < 2) {
    return NextResponse.json({ error: "يلزم طلبان على الأقل" }, { status: 400 });
  }
  const ids = [...new Set(shopifyIds.map(Number))];
  if (ids.length < 2 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return NextResponse.json({ error: "أرقام طلبات غير صالحة" }, { status: 400 });
  }

  try {
    if (!(await acquireMergeLock(ids))) {
      return NextResponse.json({ error: "الطلبات دي بيتم دمجها دلوقتي من جهاز تاني" }, { status: 409 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
  try {
    return await mergeOrders(ids);
  } finally {
    await releaseMergeLock(ids);
  }
}

async function mergeOrders(shopifyIds: number[]) {
  try {

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

    // Guard: an order already sent to J&T must not be merged — merging deletes it
    const { data: shipped } = await supabaseAdmin
      .from("shipments")
      .select("order_number")
      .in("shopify_order_id", shopifyIds)
      .not("tracking_number", "is", null);
    if (shipped?.length) {
      return NextResponse.json({ error: `لا يمكن دمج طلب اتشحن بالفعل (${shipped.map((s) => s.order_number).join("، ")})` }, { status: 422 });
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
    const phone   = toE164(base.phone ?? addr?.phone) || undefined;

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
    // The merged order is a fresh order to review → no dashboard status tag
    const tags = [...new Set(
      orders.flatMap(o => o.tags ? o.tags.split(",").map(t => t.trim()) : [])
    )].filter((t) => t && !isStatusTag(t)).join(",");

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

    // Delete the original orders (one at a time to stay under Shopify's rate limit)
    const deletedIds: number[] = [];
    for (const id of shopifyIds) {
      if (await removeOrder(Number(id))) deletedIds.push(Number(id));
    }

    return NextResponse.json({ ok: true, order: normalizeOrder(created.order), deletedIds }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
