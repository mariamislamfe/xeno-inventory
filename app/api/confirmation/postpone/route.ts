import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const { shopify_order_id, order_number, date } = await req.json();

  await supabaseAdmin.from("activity_log").insert({
    type:      "order",
    action:    "postpone_date",
    detail:    `تحديد يوم تأجيل الطلب #${order_number}: ${date}`,
    entity_id: String(shopify_order_id),
    user_name: "النظام",
    metadata:  { date, order_number },
  });

  return NextResponse.json({ ok: true });
}
