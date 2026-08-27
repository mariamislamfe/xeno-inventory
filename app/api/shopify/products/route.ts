import { NextResponse } from "next/server";
import { getShopifyProducts } from "@/lib/shopify/products";

export const revalidate = 0;

export async function GET() {
  try {
    const products = await getShopifyProducts();
    return NextResponse.json({ products, count: products.length });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
