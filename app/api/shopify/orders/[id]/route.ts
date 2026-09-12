import { NextRequest, NextResponse } from "next/server";
import { normalizeOrder } from "@/lib/shopify/orders";
import type { ShopifyOrderRaw } from "@/lib/shopify/orders";

const SHOP    = process.env.SHOPIFY_SHOP;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

function shopifyUrl(id: string) {
  return `https://${SHOP}/admin/api/${VERSION}/orders/${id}.json`;
}

function headers() {
  return { "X-Shopify-Access-Token": TOKEN!, "Content-Type": "application/json" };
}

// ── GET /api/shopify/orders/[id] ─────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SHOP || !TOKEN) return NextResponse.json({ error: "Shopify not configured" }, { status: 503 });

  try {
    const resp = await fetch(shopifyUrl(id), { headers: headers(), cache: "no-store" });
    if (!resp.ok) return NextResponse.json({ error: `Shopify ${resp.status}` }, { status: resp.status });

    const data  = await resp.json() as { order: ShopifyOrderRaw };
    const order = normalizeOrder(data.order);
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── PUT /api/shopify/orders/[id] ─────────────────────────────────────────────
// Body: { note?, tags?, phone?, address1?, city?, province?, name? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SHOP || !TOKEN) return NextResponse.json({ error: "Shopify not configured" }, { status: 503 });

  const body = await req.json();
  const { note, tags, phone, address1, city, province, name } = body;

  // Build Shopify order update payload
  interface UpdatePayload {
    id: string;
    note?: string;
    tags?: string;
    shipping_address?: Record<string, string>;
  }
  const update: UpdatePayload = { id };
  if (note   !== undefined) update.note = note;
  if (tags   !== undefined) update.tags = Array.isArray(tags) ? tags.join(",") : tags;

  const addrFields: Record<string, string> = {};
  if (phone)    addrFields.phone    = phone;
  if (address1) addrFields.address1 = address1;
  if (city)     addrFields.city     = city;
  if (province) addrFields.province = province;
  if (name)     addrFields.name     = name;
  if (Object.keys(addrFields).length) update.shipping_address = addrFields;

  try {
    const resp = await fetch(shopifyUrl(id), {
      method:  "PUT",
      headers: headers(),
      body:    JSON.stringify({ order: update }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: resp.status });
    }
    const data  = await resp.json() as { order: ShopifyOrderRaw };
    const order = normalizeOrder(data.order);
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
