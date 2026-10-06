import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { printJTOrder } from "@/lib/jt/client";
import { getLabelData } from "@/lib/label-items";
import { toLocal } from "@/lib/phone";

// Printed as the one-line sender on the waybill
function senderInfo() {
  return {
    name:  process.env.XENO_SENDER_NAME ?? "XENO",
    phone: toLocal(process.env.XENO_SENDER_PHONE ?? ""),
    city:  process.env.XENO_CITY ?? "",
  };
}

// POST /api/print/label  { shopify_order_id, preview? }
// Fetches the waybill from J&T (which marks it "Printed" there) and marks it printed here.
// preview: only for labels already printed — returns it without recording a print.
export async function POST(req: NextRequest) {
  const { shopify_order_id, preview } = await req.json();
  if (!shopify_order_id) return NextResponse.json({ error: "shopify_order_id required" }, { status: 400 });

  const { data: ship, error } = await supabaseAdmin
    .from("shipments")
    .select("id, order_number, tracking_number, label_printed")
    .eq("shopify_order_id", shopify_order_id)
    .not("tracking_number", "is", null)
    .limit(1)
    .maybeSingle();
  if (error)  return NextResponse.json({ error: error.message }, { status: 500 });
  if (!ship)  return NextResponse.json({ error: "الطلب ده ملوش شحنة على J&T" }, { status: 404 });
  if (preview && !ship.label_printed) {
    return NextResponse.json({ error: "المعاينة متاحة للبوالص المطبوعة بس" }, { status: 409 });
  }

  const [res, { items, receiver }] = await Promise.all([
    printJTOrder(ship.tracking_number),
    getLabelData(Number(shopify_order_id)),
  ]);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
  if (preview) return NextResponse.json({ ok: true, pdfBase64: res.pdfBase64, url: res.url, items, receiver, sender: senderInfo() });

  await supabaseAdmin
    .from("shipments")
    .update({ label_printed: true })
    .eq("id", ship.id);

  await supabaseAdmin.from("activity_log").insert({
    type:      "shipment",
    action:    "label_printed",
    detail:    `طباعة بوليصة ${ship.order_number} — ${ship.tracking_number}`,
    user_name: "النظام",
    metadata:  { order_number: ship.order_number, tracking_number: ship.tracking_number },
  });

  return NextResponse.json({ ok: true, pdfBase64: res.pdfBase64, url: res.url, items, receiver, sender: senderInfo() });
}
