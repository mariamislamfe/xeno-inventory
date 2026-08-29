import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

// status values coming from WA service:
//   "confirmed" → delivered (أكّد)
//   "cancelled"  → cancelled (ألغى)
// no postpone flow anymore

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-wa-secret");
  if (secret !== process.env.WA_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phone, status, shopify_order_id, order_number } = await req.json();
  if (!phone || !status)
    return NextResponse.json({ error: "phone and status required" }, { status: 400 });

  // Normalize phone (01xxxxxxxx ↔ 201xxxxxxxx)
  const normalized  = phone.replace(/[^0-9]/g, "");
  const local       = normalized.startsWith("20") ? "0" + normalized.slice(2) : normalized;
  const withCountry = local.startsWith("0") ? "20" + local.slice(1) : "20" + local;

  // Find latest sent message for this phone/order
  let query = supabaseAdmin
    .from("whatsapp_messages")
    .select("id, shopify_order_id, order_number")
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1);

  if (shopify_order_id) {
    query = query.eq("shopify_order_id", shopify_order_id);
  } else {
    query = query.or(`phone.eq.${local},phone.eq.${withCountry}`);
  }

  const { data: messages } = await query;

  if (!messages?.length) {
    return NextResponse.json({ ok: true, note: "no matching message found" });
  }

  const msg = messages[0];

  // Map status → whatsapp_messages.status column
  const waStatus = status === "confirmed" ? "delivered" : "read";

  await supabaseAdmin
    .from("whatsapp_messages")
    .update({ status: waStatus })
    .eq("id", msg.id);

  const ordNum = msg.order_number ?? order_number ?? "؟";
  const ordId  = msg.shopify_order_id ?? shopify_order_id;

  const detail =
    status === "confirmed"
      ? `✅ العميل أكّد الطلب #${ordNum}`
      : `❌ العميل ألغى الطلب #${ordNum}`;

  await supabaseAdmin.from("activity_log").insert({
    type:      "whatsapp",
    action:    status,
    detail,
    entity_id: String(ordId),
    user_name: phone,
    metadata:  { phone, status, order_number: ordNum },
  });

  return NextResponse.json({ ok: true });
}
