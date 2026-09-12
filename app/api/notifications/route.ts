import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export const revalidate = 0;

/* GET /api/notifications
   Returns last 20 activity_log entries as notifications.
   Also accepts ?mark_read=all to mark all read (stored in a separate table).
*/
export async function GET(req: NextRequest) {
  const markAll = req.nextUrl.searchParams.get("mark_read") === "all";

  const { data: logs, error } = await supabaseAdmin
    .from("activity_log")
    .select("id, type, action, detail, user_name, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    // Table might not exist yet
    return NextResponse.json({ notifications: [], unread: 0 });
  }

  // Simple "unread" tracking: entries newer than last-read timestamp stored in a settings row
  let lastRead: string | null = null;
  const { data: readRow } = await supabaseAdmin
    .from("xeno_settings")
    .select("value")
    .eq("key", "notifications_last_read")
    .maybeSingle();
  lastRead = readRow?.value ?? null;

  if (markAll) {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("xeno_settings")
      .upsert({ key: "notifications_last_read", value: now }, { onConflict: "key" });
    lastRead = now;
  }

  const notifications = (logs ?? []).map((log) => ({
    id:        log.id,
    type:      log.type as "order" | "shipment" | "inventory" | "system",
    title:     titleFor(log.action, log.type),
    message:   log.detail,
    createdAt: log.created_at,
    read:      lastRead ? log.created_at <= lastRead : false,
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
