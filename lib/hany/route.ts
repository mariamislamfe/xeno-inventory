// Server-only helpers for the internal /api/hany/* routes.
import { NextResponse } from "next/server";
import { HanyError } from "./client";
import { logOrderAction, type OrderActionKind } from "@/lib/audit";
import { supabaseAdmin } from "@/lib/supabase/client";
import { currentActor } from "@/lib/audit";
import { hanyId } from "./ids";

/** Runs the handler and turns HANY / unexpected errors into a JSON { error } with the right status. */
export async function hanyHandle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    if (err instanceof HanyError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** Order actions show up in the activity log under the signed-in user (entity = the HANY number,
 *  same as shipping and printing log it, so "آخر إجراء" and the order history see all of them). */
export function logHanyOrder(orderNumber: string, action: OrderActionKind, detail: string, metadata: Record<string, unknown> = {}) {
  return logOrderAction(hanyId(orderNumber), action, detail, { ...metadata, source: "hany", order_number: orderNumber });
}

/** Product / stock changes made from XENO. Best-effort. */
export async function logHanyInventory(action: string, detail: string, metadata: Record<string, unknown> = {}) {
  try {
    const who = await currentActor();
    await supabaseAdmin.from("activity_log").insert({
      type: "inventory", action, detail, entity_id: "hany",
      user_name: who.name, metadata: { ...metadata, source: "hany", user_id: who.id },
    });
  } catch { /* logging must not break the action */ }
}
