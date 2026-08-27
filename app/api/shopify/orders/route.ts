import { NextRequest, NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify/client";
import { normalizeOrder } from "@/lib/shopify/orders";
import type { ShopifyOrderRaw } from "@/lib/shopify/orders";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const limit            = Math.min(parseInt(sp.get("limit") ?? "50"), 250);
    const status           = sp.get("status") ?? "any";          // open | closed | cancelled | any
    const financial_status = sp.get("financial_status") ?? "";   // paid | unpaid | pending | refunded
    const fulfillment_status = sp.get("fulfillment_status") ?? ""; // fulfilled | unfulfilled | partial
    const page_info        = sp.get("page_info") ?? "";
    const query            = sp.get("query") ?? "";              // customer name / order number
    const created_at_min   = sp.get("created_at_min") ?? "";
    const created_at_max   = sp.get("created_at_max") ?? "";

    // Build Shopify query string
    let qs = `limit=${limit}`;
    if (page_info) {
      // cursor-based pagination — can ONLY combine with limit
      qs = `limit=${limit}&page_info=${page_info}`;
    } else {
      if (status)             qs += `&status=${status}`;
      if (financial_status)   qs += `&financial_status=${financial_status}`;
      if (fulfillment_status) qs += `&fulfillment_status=${fulfillment_status}`;
      if (query)              qs += `&name=${encodeURIComponent(query)}`;
      if (created_at_min)     qs += `&created_at_min=${created_at_min}`;
      if (created_at_max)     qs += `&created_at_max=${created_at_max}`;
    }

    const data = await shopifyFetch<{ orders: ShopifyOrderRaw[] }>(
      `/orders.json?${qs}`
    );

    const orders = data.orders.map(normalizeOrder);

    return NextResponse.json({
      orders,
      count: orders.length,
      has_more: orders.length === limit,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
