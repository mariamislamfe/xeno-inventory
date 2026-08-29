import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const { shopify_order_id, order_number, customer_name, phone, tracking_number } = await req.json();

  if (!phone || !tracking_number)
    return NextResponse.json({ error: "phone and tracking_number required" }, { status: 400 });

  const waUrl    = process.env.WA_SERVICE_URL;
  const waSecret = process.env.WA_SECRET;

  if (!waUrl || !waSecret)
    return NextResponse.json({ error: "WA service not configured" }, { status: 503 });

  // Send the tracking WhatsApp message
  const res  = await fetch(`${waUrl}/send-tracking`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-wa-secret": waSecret },
    body:    JSON.stringify({ phone, customer_name, order_number, tracking_number }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: 502 });
  }

  // Update shipment with tracking number
  if (shopify_order_id) {
    await supabaseAdmin
      .from("shipments")
      .update({ tracking_number, status: "shipped" })
      .eq("shopify_order_id", shopify_order_id);
  }

  // Log
  await supabaseAdmin.from("activity_log").insert({
    type:      "shipment",
    action:    "tracking_sent",
    detail:    `إرسال رقم تتبع ${tracking_number} للطلب #${order_number}`,
    entity_id: String(shopify_order_id),
    user_name: "النظام",
    metadata:  { tracking_number, phone, order_number },
  });

  return NextResponse.json({ ok: true });
}
