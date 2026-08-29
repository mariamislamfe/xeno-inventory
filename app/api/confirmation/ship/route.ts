import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const { orders } = await req.json();
  // orders: Array<{ shopify_order_id, order_number, customer_name, phone }>

  if (!orders?.length)
    return NextResponse.json({ error: "No orders provided" }, { status: 400 });

  const rows = orders.map((o: {
    shopify_order_id: number;
    order_number: string;
    customer_name: string;
    phone: string;
  }) => ({
    shopify_order_id: o.shopify_order_id,
    order_number:     o.order_number,
    customer_name:    o.customer_name,
    phone:            o.phone,
    provider:         "J&T Express",
    status:           "pending",
  }));

  const { error } = await supabaseAdmin.from("shipments").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log activity
  await supabaseAdmin.from("activity_log").insert({
    type:      "shipment",
    action:    "bulk_create",
    detail:    `إرسال ${orders.length} طلب لـ J&T Express`,
    user_name: "النظام",
    metadata:  { count: orders.length, orders: orders.map((o: { order_number: string }) => o.order_number) },
  });

  return NextResponse.json({ ok: true, count: orders.length });
}
