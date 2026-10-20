// Server-only: who did what to an order. Each team action is written to activity_log
// (type "user") with the signed-in user's name, so the activity log, the orders list
// ("آخر إجراء") and the order page history can all show it.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export interface Actor { id: string | null; name: string }

export async function currentActor(): Promise<Actor> {
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { id: null, name: "النظام" };
    const { data: p } = await supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    return { id: user.id, name: p?.full_name?.trim() || user.email?.split("@")[0] || "مستخدم" };
  } catch {
    return { id: null, name: "النظام" };
  }
}

export type OrderActionKind =
  | "status" | "ship" | "print" | "cancel_shipment" | "create" | "merge" | "edit" | "edit_items" | "delete";

/** Best-effort: a failed log write never fails the action itself. */
export async function logOrderAction(
  shopifyOrderId: number | string,
  action: OrderActionKind,
  detail: string,
  metadata: Record<string, unknown> = {},
  actor?: Actor,
) {
  try {
    const who = actor ?? await currentActor();
    await supabaseAdmin.from("activity_log").insert({
      type:      "user",
      action,
      detail,
      entity_id: String(shopifyOrderId),
      user_name: who.name,
      metadata:  { ...metadata, user_id: who.id },
    });
  } catch { /* logging must not break the action */ }
}

export interface OrderHistoryEntry { action: string; detail: string; user: string; at: string }

/** Latest team action per order (for the orders list). */
export async function lastActions(shopifyOrderIds: (number | string)[]): Promise<Map<string, OrderHistoryEntry>> {
  const out = new Map<string, OrderHistoryEntry>();
  const ids = [...new Set(shopifyOrderIds.map(String))];
  if (!ids.length) return out;
  try {
    const { data } = await supabaseAdmin
      .from("activity_log")
      .select("entity_id, action, detail, user_name, created_at")
      .eq("type", "user")
      .in("entity_id", ids)
      .order("created_at", { ascending: false })
      .limit(ids.length * 10);
    for (const r of data ?? []) {
      if (!out.has(r.entity_id)) out.set(r.entity_id, { action: r.action, detail: r.detail, user: r.user_name, at: r.created_at });
    }
  } catch { /* history is optional */ }
  return out;
}

/** Full team history of one order, newest first (for the order page). */
export async function orderHistory(shopifyOrderId: number | string): Promise<OrderHistoryEntry[]> {
  try {
    const { data } = await supabaseAdmin
      .from("activity_log")
      .select("action, detail, user_name, created_at")
      .eq("type", "user")
      .eq("entity_id", String(shopifyOrderId))
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((r) => ({ action: r.action, detail: r.detail, user: r.user_name, at: r.created_at }));
  } catch {
    return [];
  }
}
