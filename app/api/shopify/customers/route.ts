import { NextRequest, NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify/client";
import { normalizeCustomer } from "@/lib/shopify/customers";
import type { ShopifyCustomerRaw } from "@/lib/shopify/customers";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const sp        = req.nextUrl.searchParams;
    const limit     = Math.min(parseInt(sp.get("limit") ?? "50"), 250);
    const query     = sp.get("query") ?? "";
    const page_info = sp.get("page_info") ?? "";

    let qs: string;

    if (page_info) {
      // cursor-based next page — only limit + page_info allowed by Shopify
      qs = `limit=${limit}&page_info=${encodeURIComponent(page_info)}`;
    } else {
      qs = `limit=${limit}&order=${encodeURIComponent("last_order_date DESC")}`;
      if (query) qs += `&query=${encodeURIComponent(query)}`;
    }

    // Use raw fetch so we can read the Link header
    const SHOP    = process.env.SHOPIFY_SHOP;
    const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
    const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";
    const url     = `https://${SHOP}/admin/api/${VERSION}/customers.json?${qs}`;

    const resp = await fetch(url, {
      headers: { "X-Shopify-Access-Token": TOKEN! },
      cache: "no-store",
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: resp.status });
    }

    // Extract next cursor from Link header
    const linkHeader = resp.headers.get("Link") ?? "";
    let nextPageInfo: string | null = null;
    const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    if (nextMatch) nextPageInfo = decodeURIComponent(nextMatch[1]);

    const data      = (await resp.json()) as { customers: ShopifyCustomerRaw[] };
    const customers = data.customers.map(normalizeCustomer);

    return NextResponse.json({
      customers,
      count:         customers.length,
      has_more:      Boolean(nextPageInfo),
      next_page_info: nextPageInfo,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
