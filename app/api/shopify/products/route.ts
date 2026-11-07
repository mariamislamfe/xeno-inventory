import { NextRequest, NextResponse } from "next/server";
import { getAllShopifyProducts } from "@/lib/shopify/products";
import type { XenoProduct } from "@/lib/shopify/products";

export const revalidate = 0;

// Searching (the product picker, the header search) fetched every product page
// from Shopify on each keystroke. Searches reuse the list for a minute; the full
// list (inventory page) is always fresh.
const SEARCH_TTL_MS = 60 * 1000;
let searchCache: { at: number; products: Promise<XenoProduct[]> } | null = null;

function productsForSearch(): Promise<XenoProduct[]> {
  if (!searchCache || Date.now() - searchCache.at > SEARCH_TTL_MS) {
    const products = getAllShopifyProducts();
    searchCache = { at: Date.now(), products };
    products.catch(() => { searchCache = null; });
  }
  return searchCache.products;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  try {
    // Always fetch all active products, then filter locally.
    // Shopify REST title= does exact match only — local filter handles partial/Arabic search.
    const all = q ? await productsForSearch() : await getAllShopifyProducts();
    if (!q) searchCache = { at: Date.now(), products: Promise.resolve(all) };

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
