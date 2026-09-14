import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export type OpStatus = "pending" | "confirmed" | "postponed" | "cancelled" | "inquiry" | "shipped";

export const revalidate = 0;

/* ── GET: list ops, optionally by status ─────────────────────────────── */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");

  let query = supabaseAdmin
    .from("xeno_ops")
    .select("*")
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("op_status", status);

  const { data, error } = await query;

  if (error) {
    // Table not created yet
    if (error.code === "42P01") {
      return NextResponse.json({ ops: [], setup_needed: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ops: data ?? [] });
}

/* ── POST: upsert an op for a given shopify_order_id ─────────────────── */
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    shopify_order_id: number;
    order_number:     string;
    customer_name?:   string;
    phone?:           string;
    total?:           number;
    op_status?:       OpStatus;   // optional — if omitted, existing status is kept
    postponed_until?: string | null;
    inquiry_type?:    string | null;
    internal_note?:   string | null;
    items_override?:  { name: string; qty: number }[] | null;
  };

  // Build upsert payload — only include op_status if explicitly provided
  // so editing items doesn't accidentally overwrite the confirmation status
  const upsertData: Record<string, unknown> = {
    ...body,
    updated_at: new Date().toISOString(),
  };
  if (body.op_status === undefined) {
    delete upsertData.op_status;
  }

  const { data, error } = await supabaseAdmin
    .from("xeno_ops")
    .upsert(upsertData, { onConflict: "shopify_order_id" })
    .select()
    .single();

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({
        error: "جدول xeno_ops غير موجود. شغّل migration أولاً من الإعدادات.",
      }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, op: data });
}
