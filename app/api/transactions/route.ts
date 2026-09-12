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
      .from("inventory_transactions")
      .select("id, type, sku, product_name, category, quantity, note, source, created_by, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type)   query = query.eq("type", type);
    if (search) query = query.or(`sku.ilike.%${search}%,product_name.ilike.%${search}%,note.ilike.%${search}%`);

    const { data, error, count } = await query;

    if (error) {
      if (error.code === "42P01") return NextResponse.json({ transactions: [], total: 0, setup_needed: true });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const transactions = (data ?? []).map((row) => ({
      id:          row.id,
      type:        row.type as "in" | "out",
      sku:         row.sku,
      productName: row.product_name,
      category:    row.category ?? "عام",
      quantity:    row.quantity,
      note:        row.note ?? null,
      source:      row.source ?? "manual",
      createdBy:   row.created_by ?? "النظام",
      createdAt:   row.created_at,
    }));

    return NextResponse.json({ transactions, total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
