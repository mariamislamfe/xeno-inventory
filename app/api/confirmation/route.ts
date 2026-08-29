import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const sp   = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to   = sp.get("to");

  let query = supabaseAdmin
    .from("whatsapp_messages")
    .select("id, shopify_order_id, order_number, customer_name, phone, status, created_at")
    .neq("status", "failed")
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to)   query = query.lte("created_at", to);

  const { data: messages, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check which orders are already shipped
  const orderIds = (messages ?? []).map((m) => m.shopify_order_id).filter(Boolean);
  const { data: shipments } = orderIds.length
    ? await supabaseAdmin.from("shipments").select("shopify_order_id").in("shopify_order_id", orderIds)
    : { data: [] };

  const shippedSet = new Set((shipments ?? []).map((s) => s.shopify_order_id));

  const enriched = (messages ?? []).map((m) => ({
    ...m,
    shipped: shippedSet.has(m.shopify_order_id),
  }));

  // status mapping:
  //   "delivered" = confirmed (العميل أكّد)
  //   "read"      = cancelled (العميل ألغى)
  //   "sent"      = pending   (لم يرد بعد)
  const stats = {
    confirmed: enriched.filter((m) => m.status === "delivered" && !m.shipped).length,
    cancelled: enriched.filter((m) => m.status === "read").length,
    pending:   enriched.filter((m) => m.status === "sent").length,
    shipped:   enriched.filter((m) => m.shipped).length,
  };

  return NextResponse.json({ messages: enriched, stats });
}
