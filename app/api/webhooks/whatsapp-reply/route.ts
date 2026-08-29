import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-wa-secret");
  if (secret !== process.env.WA_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phone, status } = await req.json();
  if (!phone || !status)
    return NextResponse.json({ error: "phone and status required" }, { status: 400 });

  // Normalize phone for matching
  let normalized = phone.replace(/[^0-9]/g, "");
  if (normalized.startsWith("20")) normalized = "0" + normalized.slice(2);

  // Update latest pending whatsapp_message for this phone
  const { data: messages } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id, shopify_order_id, order_number")
    .eq("phone", phone)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1);

  if (messages && messages.length > 0) {
    const msg = messages[0];

    await supabaseAdmin
      .from("whatsapp_messages")
      .update({ status: status === "confirmed" ? "delivered" : "read" })
      .eq("id", msg.id);

    // Log to activity
    await supabaseAdmin.from("activity_log").insert({
      type:      "whatsapp",
      action:    status,
      detail:    status === "confirmed"
        ? `✅ العميل أكّد الطلب #${msg.order_number}`
        : `⏳ العميل أجّل الطلب #${msg.order_number}`,
      entity_id: String(msg.shopify_order_id),
      user_name: phone,
      metadata:  { phone, status, order_number: msg.order_number },
    });
  }

  return NextResponse.json({ ok: true });
}
