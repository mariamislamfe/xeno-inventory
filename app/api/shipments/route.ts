import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { fillMissingShipmentInfo } from "@/lib/shipments";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "";
  const search = sp.get("search") ?? "";
  const limit  = Math.min(parseInt(sp.get("limit") ?? "200"), 500);

  try {
    let query = supabaseAdmin
      .from("shipments")
      .select("id, shopify_order_id, order_number, tracking_number, provider, status, customer_name, phone, city, governorate, cod_amount, created_at, shipped_at, delivered_at")
      .not("tracking_number", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);

    if (search) {
      // Escape SQL wildcard characters to prevent injection
      const safe = search.replace(/[%_\\]/g, "\\$&");
      query = query.or(
        `order_number.ilike.%${safe}%,tracking_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,phone.ilike.%${safe}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ shipments: [], setup_needed: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Older shipments were saved without the COD amount / city — fill them in
    return NextResponse.json({ shipments: await fillMissingShipmentInfo(data ?? []) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
