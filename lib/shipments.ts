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
