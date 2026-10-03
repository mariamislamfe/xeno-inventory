import { NextRequest, NextResponse } from "next/server";
import { normalizeCustomer } from "@/lib/shopify/customers";
import type { ShopifyCustomerRaw } from "@/lib/shopify/customers";

export const revalidate = 0;

const SHOP    = process.env.SHOPIFY_SHOP!;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN!;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

function shopifyHeaders() {
  return { "X-Shopify-Access-Token": TOKEN };
}

// Normalize Egyptian phone → E.164 (+20...)
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("20") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0")  && digits.length >= 10) return `+20${digits.slice(1)}`;
  if (digits.length >= 9)                              return `+20${digits}`;
  return raw;
}

// Detect search intent
function detectQueryType(q: string): "order" | "phone" | "text" {
  const trimmed = q.trim();
  if (/^#?\d{3,6}$/.test(trimmed)) return "order";         // #1001 or 1001
  if (/^[\d\s\-+()]{7,}$/.test(trimmed)) return "phone";   // phone-like
  return "text";
}

// Search by order number → return matching customer(s)
async function searchByOrderNumber(orderName: string): Promise<ShopifyCustomerRaw[]> {
  const name = orderName.startsWith("#") ? orderName : `#${orderName}`;
  const url  = `https://${SHOP}/admin/api/${VERSION}/orders.json?name=${encodeURIComponent(name)}&status=any&limit=5`;
  const resp = await fetch(url, { headers: shopifyHeaders() });
  if (!resp.ok) return [];

  const data = await resp.json() as { orders: { customer?: { id: number } }[] };
  const customerIds = [...new Set(
    data.orders.map(o => o.customer?.id).filter(Boolean) as number[]
  )];

  const results = await Promise.all(customerIds.map(async (id) => {
    const r = await fetch(`https://${SHOP}/admin/api/${VERSION}/customers/${id}.json`, { headers: shopifyHeaders() });
    if (!r.ok) return null;
    const d = await r.json() as { customer: ShopifyCustomerRaw };
    return d.customer;
  }));

  return results.filter(Boolean) as ShopifyCustomerRaw[];
}

export async function GET(req: NextRequest) {
  try {
    const sp        = req.nextUrl.searchParams;
    const limit     = Math.min(parseInt(sp.get("limit") ?? "50"), 250);
    const rawQuery  = (sp.get("query") ?? "").trim();
    const page_info = sp.get("page_info") ?? "";

    // ── Order number search ──────────────────────────────────────────────
    if (rawQuery && detectQueryType(rawQuery) === "order") {
      const customers = await searchByOrderNumber(rawQuery);
      return NextResponse.json({ customers: customers.map(normalizeCustomer), count: customers.length, has_more: false, next_page_info: null });
    }

    // ── Build Shopify query string ───────────────────────────────────────
    let shopifyQuery = "";
    if (rawQuery) {
      const qType = detectQueryType(rawQuery);
      if (qType === "phone") {
        shopifyQuery = `phone:${normalizePhone(rawQuery)}`;
      } else {
        shopifyQuery = rawQuery; // name / email — pass as-is
      }
    }

    let qs: string;
    if (page_info) {
      qs = `limit=${limit}&page_info=${encodeURIComponent(page_info)}`;
    } else {
      qs = `limit=${limit}&order=${encodeURIComponent("last_order_date DESC")}`;
      if (shopifyQuery) qs += `&query=${encodeURIComponent(shopifyQuery)}`;
    }

    const url  = `https://${SHOP}/admin/api/${VERSION}/customers.json?${qs}`;
    const resp = await fetch(url, { headers: shopifyHeaders(), cache: "no-store" });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: resp.status });
    }

    const linkHeader = resp.headers.get("Link") ?? "";
    let nextPageInfo: string | null = null;
    const nextMatch  = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    if (nextMatch) nextPageInfo = decodeURIComponent(nextMatch[1]);

    const data      = (await resp.json()) as { customers: ShopifyCustomerRaw[] };
    const customers = data.customers.map(normalizeCustomer);

    return NextResponse.json({ customers, count: customers.length, has_more: Boolean(nextPageInfo), next_page_info: nextPageInfo });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
