import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { autoMergeDuplicates } from "@/lib/merge-server";

export const revalidate = 0;
export const maxDuration = 60;

/* GET /api/notifications
   Returns last 20 activity_log entries as notifications.
   Also accepts ?mark_read=all to mark all read (stored in a separate table).
*/
export async function GET(req: NextRequest) {
  const markAll = req.nextUrl.searchParams.get("mark_read") === "all";

  // Every dashboard page loads this: also merge duplicate orders (at most once a
  // minute), so it doesn't depend on someone opening the orders page
  after(() => autoMergeDuplicates());

  const { data: logs, error } = await supabaseAdmin
    .from("activity_log")
    .select("id, type, action, detail, user_name, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    // Table might not exist yet
    return NextResponse.json({ notifications: [], unread: 0 });
  }

  // Simple "unread" tracking: entries newer than the last-read time, kept in one
  // xeno_ops row (the live database has no xeno_settings table, so read state was
  // never saved and every notification always showed as unread)
  const READ_ROW = { shopify_order_id: -2, order_number: "notifications-read", op_status: "notifications_read" };
  let lastRead: string | null = null;
  const { data: readRow } = await supabaseAdmin
    .from("xeno_ops")
    .select("updated_at")
    .eq("shopify_order_id", READ_ROW.shopify_order_id)
    .maybeSingle();
  lastRead = readRow?.updated_at ?? null;

  if (markAll) {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("xeno_ops")
      .upsert({ ...READ_ROW, updated_at: now }, { onConflict: "shopify_order_id" });
    lastRead = now;
  }
  const lastReadMs = lastRead ? new Date(lastRead).getTime() : null;

  const notifications = (logs ?? []).map((log) => ({
    id:        log.id,
    type:      log.type as "order" | "shipment" | "inventory" | "system",
    title:     titleFor(log.action, log.type),
    message:   log.detail,
    createdAt: log.created_at,
    read:      lastReadMs != null ? new Date(log.created_at).getTime() <= lastReadMs : false,
    metadata:  log.metadata,
  }));

  const unread = notifications.filter((n) => !n.read).length;

  return NextResponse.json({ notifications, unread });
}

function titleFor(action: string, type: string): string {
  const map: Record<string, string> = {
    "create":      "طلب جديد",
    "update":      "تحديث طلب",
    "cancel":      "إلغاء طلب",
    "paid":        "دفع مكتمل",
    "bulk_create": "شحن دفعي",
    "postpone_date": "تأجيل طلب",
  };
  return map[action] ?? (type === "order" ? "حدث جديد" : type === "shipment" ? "تحديث شحنة" : "إشعار");
}
