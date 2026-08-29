import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const sp   = req.nextUrl.searchParams;
  const from = sp.get("from"); // ISO date string
  const to   = sp.get("to");

  let query = supabaseAdmin
    .from("whatsapp_messages")
    .select("*")
    .neq("status", "failed")
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to)   query = query.lte("created_at", to);

  const { data: messages, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get shipped order IDs
  const orderIds = (messages ?? []).map((m) => m.shopify_order_id).filter(Boolean);
  const { data: shipments } = orderIds.length
    ? await supabaseAdmin.from("shipments").select("shopify_order_id").in("shopify_order_id", orderIds)
    : { data: [] };

  const shippedSet = new Set((shipments ?? []).map((s) => s.shopify_order_id));

  // Get postpone dates from activity_log
  const { data: postponeActivities } = orderIds.length
    ? await supabaseAdmin
        .from("activity_log")
        .select("entity_id, metadata, created_at")
        .eq("action", "postpone_date")
        .in("entity_id", orderIds.map(String))
        .order("created_at", { ascending: false })
    : { data: [] };

  const postponeMap: Record<string, string> = {};
  for (const act of postponeActivities ?? []) {
    if (!postponeMap[act.entity_id]) {
      postponeMap[act.entity_id] = act.metadata?.date ?? "";
    }
  }

  const enriched = (messages ?? []).map((m) => ({
    ...m,
    shipped:      shippedSet.has(m.shopify_order_id),
    postponeDate: postponeMap[String(m.shopify_order_id)] ?? null,
  }));

  const stats = {
    confirmed: enriched.filter((m) => m.status === "delivered" && !m.shipped).length,
    postponed: enriched.filter((m) => m.status === "read").length,
    pending:   enriched.filter((m) => m.status === "sent").length,
    shipped:   enriched.filter((m) => m.shipped).length,
  };

  return NextResponse.json({ messages: enriched, stats });
}
