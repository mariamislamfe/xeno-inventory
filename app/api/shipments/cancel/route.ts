import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { cancelJTOrder, getJTOrderIdByWaybill } from "@/lib/jt/client";

// POST /api/shipments/cancel  { shopify_order_id, reason? }
// Cancels the J&T shipment and removes it here, so the order can be shipped again.
export async function POST(req: NextRequest) {
  const { shopify_order_id, reason } = await req.json().catch(() => ({}));
  if (!shopify_order_id) return NextResponse.json({ error: "shopify_order_id required" }, { status: 400 });

  const { data: ship, error } = await supabaseAdmin
    .from("shipments")
    .select("id, order_number, tracking_number, status, notes")
    .eq("shopify_order_id", shopify_order_id)
    .not("tracking_number", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!ship)  return NextResponse.json({ error: "الطلب ده مالوش شحنة على J&T" }, { status: 404 });
  if (ship.status === "delivered" || ship.status === "returned") {
    return NextResponse.json({ error: "الشحنة دي اتسلمت أو رجعت — مينفعش تتلغي" }, { status: 422 });
  }

  // The id J&T knows the order by: ask J&T, else what we saved, else the order number
  const txlogisticId = (await getJTOrderIdByWaybill(ship.tracking_number))
    ?? ship.notes
    ?? String(ship.order_number).replace(/^#/, "").trim();

  const res = await cancelJTOrder(txlogisticId, typeof reason === "string" && reason.trim() ? reason.trim() : undefined);
  const code = String(res.ok ? res.data?.code : "");
  if (!res.ok || code !== "1") {
    const msg = res.ok ? (res.data?.msg ?? "J&T رفضت الإلغاء") : res.error;
    return NextResponse.json({ error: `J&T: ${msg}${code ? ` (${code})` : ""}` }, { status: 422 });
  }

  await supabaseAdmin.from("shipments").delete().eq("id", ship.id);
  await supabaseAdmin.from("activity_log").insert({
    type:      "shipment",
    action:    "cancelled",
    detail:    `إلغاء شحنة ${ship.order_number} على J&T — ${ship.tracking_number}`,
    entity_id: String(shopify_order_id),
    user_name: "النظام",
    metadata:  { order_number: ship.order_number, tracking_number: ship.tracking_number, txlogisticId },
  });
  return NextResponse.json({ ok: true });
}
