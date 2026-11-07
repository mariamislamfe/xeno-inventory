// Server-only: merge a customer's duplicate orders into one, and find + merge them
// automatically. The orders page used to be the only place duplicates got merged,
// so they waited until someone opened it with both orders on the same page.
import { logOrderAction, type Actor } from "@/lib/audit";
import { normalizeOrder, currentQty } from "@/lib/shopify/orders";
import type { ShopifyOrderRaw } from "@/lib/shopify/orders";
import { toE164 } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/client";
import { isStatusTag, reviewStatus } from "@/lib/order-status";
import { withShipmentTracking } from "@/lib/shipments";
import { findMergeGroups } from "@/lib/merge";

const SHOP    = process.env.SHOPIFY_SHOP!;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN!;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

function h() { return { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" }; }

// fetch with retry on Shopify's REST rate limit
async function sfetch(url: string, init?: RequestInit, attempts = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    const resp = await fetch(url, { cache: "no-store", ...init });
    if (resp.status !== 429 || i >= attempts) return resp;
    const wait = Number(resp.headers.get("Retry-After")) || 1;
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

async function getOrder(id: number): Promise<ShopifyOrderRaw | null> {
  const r = await sfetch(`https://${SHOP}/admin/api/${VERSION}/orders/${id}.json`, { headers: h() });
  if (!r.ok) return null;
  const d = await r.json() as { order: ShopifyOrderRaw };
  return d.order;
}

// The merged order replaces the originals, so remove them from Shopify entirely.
// Shopify only deletes cancelled orders, so cancel first. Tried twice: an original
// left behind would be merged again later and double its items.
async function removeOrder(id: number): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await sfetch(`https://${SHOP}/admin/api/${VERSION}/orders/${id}/cancel.json`, {
      method: "POST", headers: h(), body: JSON.stringify({}),
    });
    const r = await sfetch(`https://${SHOP}/admin/api/${VERSION}/orders/${id}.json`, {
      method: "DELETE", headers: h(),
    });
    if (r.ok || r.status === 404) return true;
  }
  return false;
}

// ── Merge lock ───────────────────────────────────────────────────────────────
// Several dashboards (and the auto-merge) can try to merge the same duplicates at
// once, which would create two merged orders. Each original is claimed with a row in
// xeno_ops (UNIQUE shopify_order_id) keyed by the negated order id: one multi-row
// insert, so it either claims every original or fails as a whole.
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

/** The order an original was merged into earlier, if any (from the merge log). */
export async function mergedInto(id: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("activity_log")
    .select("entity_id")
    .eq("type", "user")
    .eq("action", "merge")
    .contains("metadata", { from: [id] })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`merge log: ${error.message}`);
  return data?.[0]?.entity_id ? Number(data[0].entity_id) : null;
}

export interface MergeResult { status: number; body: Record<string, unknown> }

/** Merge 2+ open orders of one customer into a new order and delete the originals. */
export async function mergeOrders(shopifyIds: number[], actor?: Actor): Promise<MergeResult> {
  const ids = [...new Set(shopifyIds.map(Number))];
  if (ids.length < 2 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return { status: 400, body: { error: "أرقام طلبات غير صالحة" } };
  }
  try {
    if (!(await acquireMergeLock(ids))) {
      return { status: 409, body: { error: "الطلبات دي بيتم دمجها دلوقتي من جهاز تاني" } };
    }
  } catch (err) {
    return { status: 500, body: { error: String(err) } };
  }
  try {
    return await mergeLocked(ids, actor);
  } catch (err) {
    return { status: 500, body: { error: String(err) } };
  } finally {
    await releaseMergeLock(ids);
  }
}

async function mergeLocked(shopifyIds: number[], actor?: Actor): Promise<MergeResult> {
  // Fetch full order details for all
  const orders = (await Promise.all(shopifyIds.map(getOrder))).filter(Boolean) as ShopifyOrderRaw[];
  if (orders.length < 2) {
    return { status: 422, body: { error: "تعذر جلب الطلبات من Shopify" } };
  }

  // Guard: all must be unfulfilled
  const anyFulfilled = orders.some(o => o.fulfillment_status === "fulfilled" || o.cancelled_at);
  if (anyFulfilled) {
    return { status: 422, body: { error: "لا يمكن دمج طلب مكتمل أو ملغي" } };
  }
  // Guard: an order set to ملغي on the dashboard is still open in Shopify
  const cancelled = orders.filter((o) => reviewStatus(o.tags ? o.tags.split(",") : []) === "cancelled");
  if (cancelled.length) {
    return { status: 422, body: { error: `لا يمكن دمج طلب ملغي (${cancelled.map((o) => o.name).join("، ")})` } };
  }

  // Guard: an order already sent to J&T must not be merged — merging deletes it.
  // If the check itself fails, don't merge (fail closed).
  const { data: shipped, error: shipErr } = await supabaseAdmin
    .from("shipments")
    .select("order_number")
    .in("shopify_order_id", shopifyIds)
    .not("tracking_number", "is", null);
  if (shipErr) return { status: 500, body: { error: `shipments: ${shipErr.message}` } };
  if (shipped?.length) {
    return { status: 422, body: { error: `لا يمكن دمج طلب اتشحن بالفعل (${shipped.map((s) => s.order_number).join("، ")})` } };
  }

  // Guard: an original that was already merged but couldn't be deleted then. Its items
  // are in the merged order already, so merging it again would double them: remove it
  // now instead (only while that merged order still exists).
  for (const o of orders) {
    const target = await mergedInto(o.id);
    if (!target) continue;
    const mergedOrder = await getOrder(target);
    if (!mergedOrder || mergedOrder.cancelled_at) continue;   // merged order is gone → original is real again
    const removed = await removeOrder(o.id);
    return { status: 409, body: {
      error: `الطلب ${o.name} اتدمج قبل كده في ${mergedOrder.name}${removed ? " — واتشال دلوقتي" : " ومعرفناش نشيله، امسحيه يدوي"}`,
      deletedIds: removed ? [o.id] : [],
    } };
  }

  // Merge line items: sum quantities for same variant_id, append distinct ones
  const mergedItems = new Map<string, { variantId?: number; title: string; quantity: number; price: string }>();
  for (const order of orders) {
    for (const li of order.line_items) {
      const qty = currentQty(li);   // items removed by an order edit don't come along
      if (qty <= 0) continue;
      const key = li.variant_id ? String(li.variant_id) : `custom_${li.title}`;
      if (mergedItems.has(key)) {
        mergedItems.get(key)!.quantity += qty;
      } else {
        mergedItems.set(key, {
          variantId: li.variant_id || undefined,
          title:     li.title,
          quantity:  qty,
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

  // ── Money ──
  // One shipment → one shipping fee (the highest of the originals), and whatever
  // the customer already paid online on the originals carries over: all paid →
  // "paid", some paid → "partially_paid" (J&T then collects only the rest).
  type MoneyFields = {
    total_price?: string; current_total_price?: string; total_outstanding?: string | null;
    shipping_lines?: { title: string; price: string; code?: string | null; source?: string | null }[];
  };
  const money = orders as unknown as MoneyFields[];
  type ShipLine = NonNullable<MoneyFields["shipping_lines"]>[number];
  let shipLine: ShipLine | null = null;
  for (const l of money.flatMap((m) => m.shipping_lines ?? [])) {
    if (!shipLine || parseFloat(l.price) > parseFloat(shipLine.price)) shipLine = l;
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const paidSoFar = round2(money.reduce((sum, m) => {
    const total = parseFloat(m.current_total_price ?? m.total_price ?? "0");
    const out   = m.total_outstanding != null && m.total_outstanding !== "" ? parseFloat(m.total_outstanding) : total;
    return sum + Math.max(0, total - out);
  }, 0));
  const itemsTotal  = lineItems.reduce((sum, i) => sum + i.quantity * parseFloat(String(i.price)), 0);
  const mergedTotal = round2(itemsTotal + (shipLine ? parseFloat(shipLine.price) : 0));
  const paidNow     = round2(Math.min(paidSoFar, mergedTotal));
  const financialStatus = paidNow <= 0 ? "pending" : paidNow >= mergedTotal - 0.01 ? "paid" : "partially_paid";
  const moneyNote = paidSoFar > 0
    ? `مدفوع أونلاين ${paidSoFar} من ${mergedTotal} ج.م${paidSoFar > mergedTotal + 0.01 ? ` — دفع زيادة ${round2(paidSoFar - mergedTotal)} ج.م` : ""}`
    : "";

  const newOrderPayload = {
    email:            base.email,
    financial_status: financialStatus,
    ...(paidNow > 0 ? {
      transactions: [{ kind: "sale", status: "success", amount: paidNow.toFixed(2), gateway: "manual" }],
    } : {}),
    ...(shipLine ? {
      shipping_lines: [{ title: shipLine.title, price: shipLine.price, code: shipLine.code ?? "standard", source: shipLine.source ?? "xeno" }],
    } : {}),
    send_receipt:     false,
    send_fulfillment_receipt: false,
    note:             [notes, moneyNote].filter(Boolean).join(" | ") || undefined,
    tags:             tags ? `${tags},xeno_merged` : "xeno_merged",
    ...(base.customer?.id ? { customer: { id: base.customer.id } } : {}),
    ...(addrBlock ? { shipping_address: addrBlock, billing_address: addrBlock } : {}),
    line_items: lineItems,
  };

  // Create merged order
  const createResp = await sfetch(`https://${SHOP}/admin/api/${VERSION}/orders.json`, {
    method: "POST",
    headers: h(),
    body: JSON.stringify({ order: newOrderPayload }),
  });

  if (!createResp.ok) {
    const txt = await createResp.text();
    return { status: createResp.status, body: { error: txt } };
  }

  const created = await createResp.json() as { order: ShopifyOrderRaw };
  const merged = normalizeOrder(created.order);

  // Shipped while we were merging (a ship that had already started before the lock)?
  // Then that order's items are on their way: drop the merged order, keep the originals.
  const { data: shippedNow } = await supabaseAdmin
    .from("shipments")
    .select("order_number")
    .in("shopify_order_id", shopifyIds)
    .not("tracking_number", "is", null);
  if (shippedNow?.length) {
    await removeOrder(merged.shopifyId);
    return { status: 409, body: { error: `اتشحن ${shippedNow.map((s) => s.order_number).join("، ")} أثناء الدمج — الدمج اتلغى` } };
  }

  // Log before deleting: if a delete fails, the log is what stops the leftover
  // original from being merged a second time
  await logOrderAction(merged.shopifyId, "merge",
    `دمج ${orders.map((o) => o.name).join(" + ")} في ${merged.orderNumber}${moneyNote ? ` — ${moneyNote}` : ""}`,
    { from: orders.map((o) => o.id), financial_status: financialStatus }, actor);

  // Delete the original orders (one at a time to stay under Shopify's rate limit)
  const deletedIds: number[] = [];
  for (const o of orders) {
    if (await removeOrder(o.id)) deletedIds.push(o.id);
  }

  return { status: 201, body: { ok: true, order: merged, deletedIds } };
}

// ── Auto-merge ───────────────────────────────────────────────────────────────
// Looks at every open order of the last few days (not just the page someone has
// open) and merges duplicates. Runs when an order arrives from Shopify and, at most
// once a minute, when the dashboard is used.
const AUTO_ACTOR: Actor = { id: null, name: "دمج تلقائي" };
const WINDOW_DAYS  = 7;
const MIN_GAP_MS   = 60 * 1000;
const LIST_FIELDS  = "id,name,email,phone,financial_status,fulfillment_status,total_price,current_total_price,tags,shipping_address,billing_address,fulfillments,customer,created_at,cancelled_at";

// When the last run started: one row in xeno_ops (the live database has no
// xeno_settings table). -1 is no real order id, and merge locks use -<order id>.
const RUN_ROW = { shopify_order_id: -1, order_number: "auto-merge", op_status: "auto_merge_run" };

// One run per minute across all servers: only the call that moves the timestamp runs
async function claimRun(): Promise<boolean> {
  const now    = new Date().toISOString();
  const cutoff = new Date(Date.now() - MIN_GAP_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("xeno_ops")
    .update({ updated_at: now })
    .eq("shopify_order_id", RUN_ROW.shopify_order_id)
    .lt("updated_at", cutoff)
    .select("id");
  if (error) return false;
  if (data?.length) return true;
  const ins = await supabaseAdmin.from("xeno_ops").insert({ ...RUN_ROW, updated_at: now });
  return !ins.error;   // first run ever; a recent run makes this a duplicate key
}

async function recentOpenOrders() {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const out: ShopifyOrderRaw[] = [];
  let url: string | null =
    `https://${SHOP}/admin/api/${VERSION}/orders.json?status=open&limit=250&created_at_min=${since}&fields=${LIST_FIELDS}`;
  for (let page = 0; page < 4 && url; page++) {
    const r = await sfetch(url, { headers: h() });
    if (!r.ok) throw new Error(`Shopify ${r.status}`);
    const d = await r.json() as { orders: ShopifyOrderRaw[] };
    out.push(...d.orders);
    url = (r.headers.get("link") ?? "").match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  return out.map((o) => normalizeOrder({ ...o, line_items: o.line_items ?? [], fulfillments: o.fulfillments ?? [] }));
}

/** Merge every group of duplicate open orders. Returns the ids of merged-away originals. */
export async function autoMergeDuplicates(opts: { force?: boolean } = {}): Promise<{ merged: number; mergedAway: number[] }> {
  const none = { merged: 0, mergedAway: [] as number[] };
  if (!SHOP || !TOKEN) return none;
  try {
    if (!opts.force && !(await claimRun())) return none;
    const orders = await withShipmentTracking(await recentOpenOrders());
    let merged = 0;
    const mergedAway: number[] = [];
    for (const group of findMergeGroups(orders).values()) {
      const res = await mergeOrders(group.map((o) => o.shopifyId), AUTO_ACTOR);
      if (res.status === 201) {
        merged++;
        mergedAway.push(...group.map((o) => o.shopifyId));
      } else if (res.status !== 409) {
        console.error("[auto-merge]", group.map((o) => o.orderNumber).join(" + "), res.body.error);
      }
    }
    return { merged, mergedAway };
  } catch (err) {
    console.error("[auto-merge] failed:", err);
    return none;
  }
}
