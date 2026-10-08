// Server-only: J&T shipments are recorded in our `shipments` table, not on the Shopify
// order, so Shopify data alone never shows their tracking numbers. Fill them in here.
import { supabaseAdmin } from "@/lib/supabase/client";
import type { XenoOrder } from "@/lib/shopify/orders";
import { traceJTBatch, statusFromScans } from "@/lib/jt/client";

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

// Pull the latest status for shipments that aren't finished yet. Each shipment is
// checked at most every `minAgeMs` (its updated_at marks the last check).
export async function syncShipmentStatuses(opts: { minAgeMs?: number; limit?: number } = {}) {
  const minAge = opts.minAgeMs ?? 10 * 60 * 1000;
  const { data: rows, error } = await supabaseAdmin
    .from("shipments")
    .select("id, tracking_number, status, shipped_at, delivered_at")
    .not("tracking_number", "is", null)
    .not("status", "in", "(delivered,returned)")
    .lt("updated_at", new Date(Date.now() - minAge).toISOString())
    .order("updated_at", { ascending: true })
    .limit(opts.limit ?? 300);
  if (error) return { checked: 0, updated: 0, error: error.message };
  if (!rows?.length) return { checked: 0, updated: 0 };

  const scans = await traceJTBatch(rows.map((r) => r.tracking_number as string));
  let updated = 0;
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
    if (status !== r.status) updated++;
    await supabaseAdmin.from("shipments").update(patch).eq("id", r.id);
  }
  return { checked: rows.length, updated };
}
