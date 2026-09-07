import { NextRequest, NextResponse } from "next/server";
import { normalizeOrder } from "@/lib/shopify/orders";
import type { ShopifyOrderRaw } from "@/lib/shopify/orders";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const limit              = Math.min(parseInt(sp.get("limit") ?? "50"), 250);
    const status             = sp.get("status") ?? "any";
    const financial_status   = sp.get("financial_status") ?? "";
    const fulfillment_status = sp.get("fulfillment_status") ?? "";
    const page_info          = sp.get("page_info") ?? "";
    const query              = sp.get("query") ?? "";
    const created_at_min     = sp.get("created_at_min") ?? "";
    const created_at_max     = sp.get("created_at_max") ?? "";
    const tag                = sp.get("tag") ?? "";  // filter by Shopify tag (e.g. vrobo tags)

    // Raw fetch so we can read the Link header for cursor pagination
    const SHOP    = process.env.SHOPIFY_SHOP;
    const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
    const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

    let qs = `limit=${limit}`;
    if (page_info) {
      qs = `limit=${limit}&page_info=${encodeURIComponent(page_info)}`;
    } else {
      if (status)             qs += `&status=${status}`;
      if (financial_status)   qs += `&financial_status=${financial_status}`;
      if (fulfillment_status) qs += `&fulfillment_status=${fulfillment_status}`;
      if (query)              qs += `&name=${encodeURIComponent(query)}`;
      if (created_at_min)     qs += `&created_at_min=${created_at_min}`;
      if (created_at_max)     qs += `&created_at_max=${created_at_max}`;
      if (tag)                qs += `&tag=${encodeURIComponent(tag)}`;
    }

    const url  = `https://${SHOP}/admin/api/${VERSION}/orders.json?${qs}`;
    const resp = await fetch(url, {
      headers: { "X-Shopify-Access-Token": TOKEN! },
      cache:   "no-store",
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: resp.status });
    }

    // Extract cursor from Link header
    const linkHeader  = resp.headers.get("Link") ?? "";
    const nextMatch   = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    const nextPageInfo = nextMatch ? decodeURIComponent(nextMatch[1]) : null;

    const data   = (await resp.json()) as { orders: ShopifyOrderRaw[] };
    const orders = data.orders.map(normalizeOrder);

    return NextResponse.json({
      orders,
      count:          orders.length,
      has_more:       Boolean(nextPageInfo),
      next_page_info: nextPageInfo,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
