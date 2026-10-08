import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { currentQty } from "@/lib/shopify/orders";

export const revalidate = 0;

interface RowItem { sku: string; name: string; variant: string; qty: number }

// Items for many orders at once: Shopify takes up to 250 ids per call; items edited
// in the dashboard (xeno_ops.items_override) win, like when shipping/printing
async function itemsByOrder(ids: number[]): Promise<Map<number, RowItem[]>> {
  const out = new Map<number, RowItem[]>();
  if (!ids.length) return out;
  const shop    = process.env.SHOPIFY_SHOP;
  const token   = process.env.SHOPIFY_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

  if (shop && token) {
    for (let i = 0; i < ids.length; i += 250) {
      const chunk = ids.slice(i, i + 250);
      try {
        const res = await fetch(
          `https://${shop}/admin/api/${version}/orders.json?status=any&limit=250&fields=id,line_items&ids=${chunk.join(",")}`,
          { headers: { "X-Shopify-Access-Token": token }, cache: "no-store" },
        );
        if (!res.ok) continue;
        const data = await res.json() as { orders: { id: number; line_items: { sku: string | null; title: string; variant_title: string | null; quantity: number; current_quantity?: number }[] }[] };
        for (const o of data.orders) {
          out.set(o.id, o.line_items.filter((li) => currentQty(li) > 0)
            .map((li) => ({ sku: li.sku ?? "", name: li.title, variant: li.variant_title ?? "", qty: currentQty(li) })));
        }
      } catch { /* leave those rows without items */ }
    }
  }

  const { data: ops } = await supabaseAdmin
    .from("xeno_ops")
    .select("shopify_order_id, items_override")
    .in("shopify_order_id", ids)
    .not("items_override", "is", null);
  for (const op of ops ?? []) {
    const items = op.items_override as { name: string; qty: number; sku?: string; variant?: string }[];
    if (items?.length) out.set(Number(op.shopify_order_id), items.map((i) => ({ sku: i.sku ?? "", name: i.name, variant: i.variant ?? "", qty: i.qty })));
  }
  return out;
}

// GET /api/print?printed=0|1 — shipped orders (have a J&T tracking number) by label
// status, each with its items (for the SKU filter)
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

  const rows  = data ?? [];
  const items = await itemsByOrder(rows.map((r) => Number(r.shopify_order_id)));
  return NextResponse.json({
    shipments: rows.map((r) => ({ ...r, items: items.get(Number(r.shopify_order_id)) ?? [] })),
  });
}
