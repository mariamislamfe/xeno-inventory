import { NextRequest, NextResponse } from "next/server";
import { getAllShopifyProducts } from "@/lib/shopify/products";
import type { XenoProduct } from "@/lib/shopify/products";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  try {
    // Always fetch all active products, then filter locally.
    // Shopify REST title= does exact match only — local filter handles partial/Arabic search.
    const all = await getAllShopifyProducts();

    let products: XenoProduct[];
    if (q) {
      const lower = q.toLowerCase();
      products = all.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.sku.toLowerCase().includes(lower) ||
          p.category.toLowerCase().includes(lower),
      );
    } else {
      products = all;
    }

    return NextResponse.json({ products, count: products.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
