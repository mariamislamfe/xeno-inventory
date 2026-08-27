import { NextRequest, NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify/client";
import { normalizeCustomer } from "@/lib/shopify/customers";
import type { ShopifyCustomerRaw } from "@/lib/shopify/customers";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const sp    = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(sp.get("limit") ?? "50"), 250);
    const query = sp.get("query") ?? "";
    const order = sp.get("order") ?? "last_order_date DESC";

    let qs = `limit=${limit}&order=${encodeURIComponent(order)}`;
    if (query) qs += `&query=${encodeURIComponent(query)}`;

    const data = await shopifyFetch<{ customers: ShopifyCustomerRaw[] }>(
      `/customers.json?${qs}`
    );

    const customers = data.customers.map(normalizeCustomer);
    return NextResponse.json({ customers, count: customers.length, has_more: customers.length === limit });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
