import { NextRequest, NextResponse } from "next/server";
import { normalizeCustomer } from "@/lib/shopify/customers";
import type { ShopifyCustomerRaw } from "@/lib/shopify/customers";

export const revalidate = 0;

const SHOP    = process.env.SHOPIFY_SHOP!;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN!;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

function h() { return { "X-Shopify-Access-Token": TOKEN }; }

// Normalize Egyptian phone → E.164 (+20...)
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("20") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0")  && digits.length >= 10) return `+20${digits.slice(1)}`;
  if (digits.length >= 9)                              return `+20${digits}`;
  return raw;
}

function isPhone(q: string)       { return /^[\d\s\-+()]{7,}$/.test(q.trim()); }
function isOrderNum(q: string)    { return /^#?\d{3,6}$/.test(q.trim()); }

// Search by order number → return matching customer(s)
async function searchByOrderNumber(raw: string): Promise<ShopifyCustomerRaw[]> {
  const name = raw.startsWith("#") ? raw : `#${raw}`;
  const resp = await fetch(
    `https://${SHOP}/admin/api/${VERSION}/orders.json?name=${encodeURIComponent(name)}&status=any&limit=5`,
    { headers: h() }
  );
  if (!resp.ok) return [];
  const data = await resp.json() as { orders: { customer?: { id: number } }[] };
  const ids   = [...new Set(data.orders.map(o => o.customer?.id).filter(Boolean) as number[])];
  const rows  = await Promise.all(ids.map(async id => {
    const r = await fetch(`https://${SHOP}/admin/api/${VERSION}/customers/${id}.json`, { headers: h() });
    if (!r.ok) return null;
    const d = await r.json() as { customer: ShopifyCustomerRaw };
    return d.customer;
  }));
  return rows.filter(Boolean) as ShopifyCustomerRaw[];
}

// Real customer search using Shopify's dedicated search endpoint
async function searchCustomers(rawQuery: string, limit: number): Promise<{ customers: ShopifyCustomerRaw[]; nextPageInfo: string | null }> {
  // Build the search query for Shopify's search.json
  let query: string;
  if (isPhone(rawQuery)) {
    // Try both normalized E.164 and raw — phone:VALUE format
    query = `phone:${normalizePhone(rawQuery)}`;
  } else {
    // Name / email free text — Shopify search.json supports Arabic names
    query = rawQuery;
  }

  const url  = `https://${SHOP}/admin/api/${VERSION}/customers/search.json?query=${encodeURIComponent(query)}&limit=${limit}&order=${encodeURIComponent("updated_at DESC")}`;
  const resp = await fetch(url, { headers: h(), cache: "no-store" });

  if (!resp.ok) return { customers: [], nextPageInfo: null };

  const linkHeader  = resp.headers.get("Link") ?? "";
  const nextMatch   = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
  const nextPageInfo = nextMatch ? decodeURIComponent(nextMatch[1]) : null;

  const data = await resp.json() as { customers: ShopifyCustomerRaw[] };
  return { customers: data.customers ?? [], nextPageInfo };
}

export async function GET(req: NextRequest) {
  try {
    const sp        = req.nextUrl.searchParams;
    const limit     = Math.min(parseInt(sp.get("limit") ?? "50"), 250);
    const rawQuery  = (sp.get("query") ?? "").trim();
    const page_info = sp.get("page_info") ?? "";

    // ── Order number search ──────────────────────────────────────────────
    if (rawQuery && isOrderNum(rawQuery)) {
      const customers = await searchByOrderNumber(rawQuery);
      return NextResponse.json({ customers: customers.map(normalizeCustomer), count: customers.length, has_more: false, next_page_info: null });
    }

    // ── Real search via customers/search.json ────────────────────────────
    if (rawQuery) {
      const { customers, nextPageInfo } = await searchCustomers(rawQuery, limit);
      return NextResponse.json({
        customers:      customers.map(normalizeCustomer),
        count:          customers.length,
        has_more:       Boolean(nextPageInfo),
        next_page_info: nextPageInfo,
      });
    }

    // ── Initial listing (no search) via customers.json ───────────────────
    let qs: string;
    if (page_info) {
      qs = `limit=${limit}&page_info=${encodeURIComponent(page_info)}`;
    } else {
      qs = `limit=${limit}&order=${encodeURIComponent("updated_at DESC")}`;
    }

    const url  = `https://${SHOP}/admin/api/${VERSION}/customers.json?${qs}`;
    const resp = await fetch(url, { headers: h(), cache: "no-store" });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: resp.status });
    }

    const linkHeader  = resp.headers.get("Link") ?? "";
    const nextMatch   = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    const nextPageInfo = nextMatch ? decodeURIComponent(nextMatch[1]) : null;

    const data      = await resp.json() as { customers: ShopifyCustomerRaw[] };
    const customers = data.customers.map(normalizeCustomer);

    return NextResponse.json({ customers, count: customers.length, has_more: Boolean(nextPageInfo), next_page_info: nextPageInfo });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
