// Server-only: J&T shipments are recorded in our `shipments` table, not on the Shopify
// order, so Shopify data alone never shows their tracking numbers. Fill them in here.
import { supabaseAdmin } from "@/lib/supabase/client";
import type { XenoOrder } from "@/lib/shopify/orders";
import { traceJTBatch, statusFromScans } from "@/lib/jt/client";
import { isHanyId } from "@/lib/hany/ids";

export async function withShipmentTracking(orders: XenoOrder[]): Promise<XenoOrder[]> {
  const ids = orders.filter((o) => !o.trackingNumber).map((o) => o.shopifyId);
  if (ids.length === 0) return orders;

  try {
    const { data, error } = await supabaseAdmin
      .from("shipments")
      .select("shopify_order_id, tracking_number, provider")
      .in("shopify_order_id", ids)
      .not("tracking_number", "is", null);
    if (error || !data?.length) return orders;

    const byId = new Map(data.map((s) => [Number(s.shopify_order_id), s]));
    return orders.map((o) => {
      const s = o.trackingNumber ? undefined : byId.get(o.shopifyId);
      return s ? { ...o, trackingNumber: s.tracking_number, shippingProvider: s.provider ?? "J&T Express" } : o;
    });
  } catch {
    return orders; // shipments table unavailable — show Shopify data as-is
  }
}

export interface ShipmentRecord {
  shopify_order_id: number;
  order_number:     string;
  customer_name?:   string | null;
  phone?:           string | null;
  provider:         string;
  status:           string;
  tracking_number:  string | null;
  cod_amount?:      number | null;
  address?:         string | null;
  city?:            string | null;
  governorate?:     string | null;
  notes?:           string | null;   // J&T order id (txlogisticId) used for this shipment
}

// Save one shipment per order without relying on ON CONFLICT — the live table may be
// missing the UNIQUE(shopify_order_id) constraint, which makes upsert fail silently.
export async function saveShipment(rec: ShipmentRecord): Promise<string | null> {
  const { data: rows, error: selErr } = await supabaseAdmin
    .from("shipments")
    .select("id")
    .eq("shopify_order_id", rec.shopify_order_id)
    .limit(1);
  if (selErr) return selErr.message;

  const row = { ...rec };
  if (rows?.length) {
    // Never replace a saved tracking number with an empty one (e.g. a second,
    // concurrent ship request that J&T rejected as a duplicate)
    let q = supabaseAdmin.from("shipments").update(row).eq("shopify_order_id", rec.shopify_order_id);
    if (!rec.tracking_number) q = q.is("tracking_number", null);
    const { error } = await q;
    return error ? error.message : null;
  }
  const { error } = await supabaseAdmin.from("shipments").insert(row);
  return error ? error.message : null;
}

interface SyncRow {
  id: string; shopify_order_id: number; order_number: string | null; tracking_number: string | null;
  status: string; shipped_at: string | null; delivered_at: string | null;
}
const SYNC_COLS = "id, shopify_order_id, order_number, tracking_number, status, shipped_at, delivered_at";

// Pull the latest status for shipments that aren't finished yet. Each shipment is
// checked at most every `minAgeMs` (its updated_at marks the last check).
// With `trackingNumbers`, exactly those shipments are checked (e.g. the ones on the
// print page) — the general queue is long and full of old never-picked-up shipments,
// so today's orders could wait a long time there.
export async function syncShipmentStatuses(opts: { minAgeMs?: number; limit?: number; trackingNumbers?: string[] } = {}) {
  const minAge = opts.minAgeMs ?? 10 * 60 * 1000;
  let rows: SyncRow[] = [];
  if (opts.trackingNumbers) {
    const codes = [...new Set(opts.trackingNumbers.filter(Boolean))].slice(0, 600);
    for (let i = 0; i < codes.length; i += 150) {
      const { data, error } = await supabaseAdmin
        .from("shipments").select(SYNC_COLS)
        .in("tracking_number", codes.slice(i, i + 150))
        .not("status", "in", "(delivered,returned)");
      if (error) return { checked: 0, updated: 0, error: error.message };
      rows.push(...((data ?? []) as SyncRow[]));
    }
  } else {
    const { data, error } = await supabaseAdmin
      .from("shipments").select(SYNC_COLS)
      .not("tracking_number", "is", null)
      .not("status", "in", "(delivered,returned)")
      .lt("updated_at", new Date(Date.now() - minAge).toISOString())
      .order("updated_at", { ascending: true })
      .limit(opts.limit ?? 300);
    if (error) return { checked: 0, updated: 0, error: error.message };
    rows = (data ?? []) as SyncRow[];
  }
  if (!rows.length) return { checked: 0, updated: 0 };
  const targeted = !!opts.trackingNumbers;

  const scans = await traceJTBatch(rows.map((r) => r.tracking_number as string));
  const writes: PromiseLike<unknown>[] = [];
  let updated = 0;
  const hanyChanges: { shopify_order_id: number; order_number: string | null; status: string }[] = [];
  const now = new Date().toISOString();
  for (const r of rows) {
    const list = scans.get(r.tracking_number as string);
    if (!list) continue;   // J&T didn't answer for it — try again next time
    const status = statusFromScans(list);
    const patch: Record<string, unknown> = { status, updated_at: now };
    if (status !== "pending" && !r.shipped_at) {
      const first = [...list].sort((a, b) => String(a.scanTime).localeCompare(String(b.scanTime)))[0];
      patch.shipped_at = first?.scanTime ? new Date(first.scanTime.replace(" ", "T") + "+02:00").toISOString() : now;
    }
    if (status === "delivered" && !r.delivered_at) patch.delivered_at = now;
    if (status !== r.status) {
      updated++;
      if (isHanyId(r.shopify_order_id)) hanyChanges.push({ shopify_order_id: Number(r.shopify_order_id), order_number: r.order_number, status });
    }
    // Targeted checks only write what changed (keeps it fast for hundreds of rows)
    if (targeted && status === r.status && !patch.shipped_at && !patch.delivered_at) continue;
    writes.push(supabaseAdmin.from("shipments").update(patch).eq("id", r.id).then(() => null));
    if (writes.length >= 20) { await Promise.all(writes); writes.length = 0; }
  }
  await Promise.all(writes);
  // HANY orders: tell the HANY store too (اتشحن / اتسلم), so its customer sees it
  if (hanyChanges.length) await (await import("@/lib/hany/fulfilment")).pushHanyShipmentStatus(hanyChanges);
  return { checked: rows.length, updated };
}

interface ShipmentListRow {
  id: string;
  shopify_order_id: number;
  cod_amount: number | null;
  city?: string | null;
  governorate?: string | null;
  address?: string | null;
}

// Shipments made before we stored the COD amount / address: fill them from the
// Shopify order (current total, i.e. after edits — what J&T was asked to collect
// unless the order was edited after shipping), save them, and return the rows.
export async function fillMissingShipmentInfo<T extends ShipmentListRow>(rows: T[]): Promise<T[]> {
  const missing = rows.filter((r) => !r.cod_amount || !r.city);
  if (!missing.length) return rows;
  const shop    = process.env.SHOPIFY_SHOP;
  const token   = process.env.SHOPIFY_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";
  if (!shop || !token) return rows;

  const found = new Map<number, Partial<ShipmentListRow>>();
  const ids = [...new Set(missing.map((r) => Number(r.shopify_order_id)))];
  for (let i = 0; i < ids.length; i += 250) {
    try {
      const res = await fetch(
        `https://${shop}/admin/api/${version}/orders.json?status=any&limit=250&fields=id,total_price,current_total_price,shipping_address&ids=${ids.slice(i, i + 250).join(",")}`,
        { headers: { "X-Shopify-Access-Token": token }, cache: "no-store" },
      );
      if (!res.ok) continue;
      const data = await res.json() as { orders: { id: number; total_price?: string; current_total_price?: string; shipping_address?: { address1?: string; city?: string; province?: string } | null }[] };
      for (const o of data.orders) {
        found.set(o.id, {
          cod_amount:  parseFloat(o.current_total_price ?? o.total_price ?? "0"),
          city:        o.shipping_address?.city ?? null,
          governorate: o.shipping_address?.province ?? null,
          address:     o.shipping_address?.address1 ?? null,
        });
      }
    } catch { /* leave those rows as they are */ }
  }

  const out: T[] = [];
  for (const r of rows) {
    const f = found.get(Number(r.shopify_order_id));
    if (!f || (r.cod_amount && r.city)) { out.push(r); continue; }
    const patch: Record<string, unknown> = {};
    if (!r.cod_amount && f.cod_amount) patch.cod_amount = f.cod_amount;
    if (!r.city && f.city) { patch.city = f.city; patch.governorate = f.governorate; if (!r.address) patch.address = f.address; }
    if (Object.keys(patch).length) await supabaseAdmin.from("shipments").update(patch).eq("id", r.id);
    out.push({ ...r, ...patch });
  }
  return out;
}
