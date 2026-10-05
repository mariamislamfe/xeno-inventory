// Server-only: J&T shipments are recorded in our `shipments` table, not on the Shopify
// order, so Shopify data alone never shows their tracking numbers. Fill them in here.
import { supabaseAdmin } from "@/lib/supabase/client";
import type { XenoOrder } from "@/lib/shopify/orders";

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
  const { error } = rows?.length
    ? await supabaseAdmin.from("shipments").update(row).eq("shopify_order_id", rec.shopify_order_id)
    : await supabaseAdmin.from("shipments").insert(row);
  return error ? error.message : null;
}
