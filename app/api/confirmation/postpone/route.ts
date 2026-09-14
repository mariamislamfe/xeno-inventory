import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { shopify_order_id, order_number, date } = body;

  if (!shopify_order_id || !order_number) {
    return NextResponse.json({ error: "shopify_order_id and order_number required" }, { status: 400 });
  }

  await supabaseAdmin.from("activity_log").insert({
    type:      "order",
    action:    "postpone_date",
    detail:    `تحديد يوم تأجيل الطلب #${order_number}: ${date ?? "غير محدد"}`,
    entity_id: String(shopify_order_id),
    user_name: "النظام",
    metadata:  { date, order_number },
  });

  return NextResponse.json({ ok: true });
}
