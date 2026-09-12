import { NextRequest, NextResponse } from "next/server";
import { getShopifyProducts } from "@/lib/shopify/products";
import { shopifyFetch } from "@/lib/shopify/client";
import type { XenoProduct } from "@/lib/shopify/products";
import { normalizeProduct } from "@/lib/shopify/products";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    let products: XenoProduct[];
    if (q) {
      // Shopify title search
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const data = await shopifyFetch<{ products: any[] }>(
        `/products.json?limit=50&status=active&title=${encodeURIComponent(q)}`
      );
      products = data.products.map(normalizeProduct);
    } else {
      products = await getShopifyProducts(100);
    }
    return NextResponse.json({ products, count: products.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
