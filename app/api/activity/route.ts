import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const type   = sp.get("type")   ?? "";
  const search = sp.get("search") ?? "";
  const limit  = Math.min(parseInt(sp.get("limit") ?? "100"), 500);
  const offset = parseInt(sp.get("offset") ?? "0");

  try {
    let query = supabaseAdmin
      .from("activity_log")
      .select("id, type, action, detail, user_name, entity_id, metadata, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type)   query = query.eq("type", type);
    if (search) {
      const safe = search.replace(/[%_\\]/g, "\\$&");
      query = query.or(`action.ilike.%${safe}%,detail.ilike.%${safe}%,user_name.ilike.%${safe}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      if (error.code === "42P01") return NextResponse.json({ events: [], total: 0, setup_needed: true });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: data ?? [], total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
