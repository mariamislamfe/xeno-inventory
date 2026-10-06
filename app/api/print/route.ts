import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";

export const revalidate = 0;

// GET /api/print?printed=0|1 — shipped orders (have a J&T tracking number) by label status
export async function GET(req: NextRequest) {
  const printed = req.nextUrl.searchParams.get("printed") === "1";

  const { data, error } = await supabaseAdmin
    .from("shipments")
    .select("id, shopify_order_id, order_number, tracking_number, customer_name, phone, city, governorate, cod_amount, created_at, shipped_at")
    .not("tracking_number", "is", null)
    .eq("label_printed", printed)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shipments: data ?? [] });
}
