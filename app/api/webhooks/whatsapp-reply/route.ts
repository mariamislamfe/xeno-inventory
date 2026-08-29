import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-wa-secret");
  if (secret !== process.env.WA_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phone, status, postponeDate, shopify_order_id, order_number } = await req.json();
  if (!phone || !status)
    return NextResponse.json({ error: "phone and status required" }, { status: 400 });

  // Try to match by phone — normalize both formats (01xxxxxxxx ↔ 201xxxxxxxx)
  let normalized = phone.replace(/[^0-9]/g, "");
  if (normalized.startsWith("20")) normalized = "0" + normalized.slice(2);
  const withCountry = "20" + normalized.slice(1);

  // Lookup latest pending message for this phone
  let query = supabaseAdmin
    .from("whatsapp_messages")
    .select("id, shopify_order_id, order_number")
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1);

  // Use the order ID from WA service if provided, otherwise match by phone
  if (shopify_order_id) {
    query = query.eq("shopify_order_id", shopify_order_id);
  } else {
    query = query.or(`phone.eq.${normalized},phone.eq.${withCountry}`);
  }

  const { data: messages } = await query;

  if (messages && messages.length > 0) {
    const msg = messages[0];
    const waStatus = status === "confirmed" ? "delivered" : "read";

    await supabaseAdmin
      .from("whatsapp_messages")
      .update({ status: waStatus })
      .eq("id", msg.id);

    const ordNum = msg.order_number ?? order_number ?? "؟";
    const ordId  = msg.shopify_order_id ?? shopify_order_id;

    // Log decision
    await supabaseAdmin.from("activity_log").insert({
      type:      "whatsapp",
      action:    status,
      detail:    status === "confirmed"
        ? `✅ العميل أكّد الطلب #${ordNum}`
        : `⏳ العميل أجّل الطلب #${ordNum}`,
      entity_id: String(ordId),
      user_name: phone,
      metadata:  { phone, status, order_number: ordNum },
    });

    // If postponed and a date was chosen, also save it
    if (status === "postponed" && postponeDate) {
      await supabaseAdmin.from("activity_log").insert({
        type:      "order",
        action:    "postpone_date",
        detail:    `تحديد يوم تأجيل الطلب #${ordNum}: ${postponeDate}`,
        entity_id: String(ordId),
        user_name: "واتساب",
        metadata:  { date: postponeDate, order_number: ordNum, source: "whatsapp_customer" },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
