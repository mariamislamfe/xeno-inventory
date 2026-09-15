import { NextRequest, NextResponse } from "next/server";
import { normalizeOrder } from "@/lib/shopify/orders";
import type { ShopifyOrderRaw } from "@/lib/shopify/orders";

const SHOP    = process.env.SHOPIFY_SHOP;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!SHOP || !TOKEN) return NextResponse.json({ error: "Shopify not configured" }, { status: 503 });

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
    const tag                = sp.get("tag") ?? "";

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
      headers: { "X-Shopify-Access-Token": TOKEN },
      cache:   "no-store",
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: resp.status });
    }

    const linkHeader   = resp.headers.get("Link") ?? "";
    const nextMatch    = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
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

const GOV_EN: Record<string, string> = {
  "القاهرة":       "Cairo",
  "الإسكندرية":    "Alexandria",
  "الجيزة":        "Giza",
  "الشرقية":       "Ash Sharqiyah",
  "الدقهلية":      "Ad Daqahliyah",
  "البحيرة":       "Al Buhayrah",
  "المنوفية":      "Al Minufiyah",
  "الغربية":       "Al Gharbiyah",
  "كفر الشيخ":     "Kafr ash Shaykh",
  "الإسماعيلية":   "Al Isma'iliyah",
  "بورسعيد":       "Bur Sa'id",
  "السويس":        "As Suways",
  "شمال سيناء":    "Shamal Sina'",
  "جنوب سيناء":    "Janub Sina'",
  "الفيوم":        "Al Fayyum",
  "بني سويف":      "Bani Suwayf",
  "المنيا":        "Al Minya",
  "أسيوط":        "Asyut",
  "سوهاج":        "Suhaj",
  "قنا":           "Qina",
  "الأقصر":        "Al Uqsur",
  "أسوان":        "Aswan",
  "البحر الأحمر":  "Al Bahr al Ahmar",
  "الوادي الجديد": "Al Wadi al Jadid",
  "مطروح":        "Matruh",
  "دمياط":        "Dumyat",
  "القليوبية":     "Al Qalyubiyah",
};

async function resolveCustomerId(shop: string, token: string, version: string, firstName: string, lastName: string, rawPhone: string): Promise<number | null> {
  const digits = rawPhone.replace(/[^0-9]/g, "");
  const e164   = digits.startsWith("0") ? `+20${digits.slice(1)}` : `+${digits}`;

  try {
    const r = await fetch(
      `https://${shop}/admin/api/${version}/customers/search.json?query=phone:${encodeURIComponent(e164)}&limit=1`,
      { headers: { "X-Shopify-Access-Token": token } },
    );
    if (r.ok) {
      const d = await r.json() as { customers: { id: number }[] };
      if (d.customers.length > 0) return d.customers[0].id;
    }
  } catch { /* ignore */ }

  try {
    const r = await fetch(`https://${shop}/admin/api/${version}/customers.json`, {
      method:  "POST",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body:    JSON.stringify({ customer: { first_name: firstName, last_name: lastName || undefined, phone: e164, verified_email: false, accepts_marketing: false } }),
    });
    if (r.ok) {
      const d = await r.json() as { customer: { id: number } };
      return d.customer.id;
    }
  } catch { /* ignore */ }

  return null;
}

// ── POST /api/shopify/orders — Create a new order (COD) ──────────────────────
// Body: { customerName, phone, address1, city, province, note?, items: [{variantId,qty,price,title}], total }
export async function POST(req: NextRequest) {
  if (!SHOP || !TOKEN) return NextResponse.json({ error: "Shopify not configured" }, { status: 503 });

  try {
    const body = await req.json();
    const { customerName, phone, address1, city, province, note, items, total } = body;

    if (!customerName || !phone || !address1 || !city) {
      return NextResponse.json({ error: "customerName, phone, address1, city required" }, { status: 400 });
    }
    if (!items?.length) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    // Build Shopify order payload
    const nameParts   = customerName.trim().split(" ");
    const firstName   = nameParts[0] ?? customerName;
    const lastName    = nameParts.slice(1).join(" ") || "";

    const customerId  = await resolveCustomerId(SHOP, TOKEN, VERSION, firstName, lastName, phone);

    const shopifyOrder: Record<string, unknown> = {
      financial_status: "pending",
      send_receipt:     false,
      send_fulfillment_receipt: false,
      note:             note ?? "",
      tags:             "xeno_manual",
      ...(customerId ? { customer: { id: customerId } } : {}),
      shipping_address: {
        first_name: firstName,
        last_name:  lastName,
        phone:      phone.replace(/[^0-9+]/g, ""),
        address1,
        city,
        province:   GOV_EN[province] ?? province ?? city,
        country:    "EG",
      },
      line_items: items.map((item: { variantId?: number; title: string; qty: number; price: number }) => ({
        ...(item.variantId ? { variant_id: item.variantId } : { title: item.title }),
        quantity:       item.qty,
        price:          String(item.price),
        requires_shipping: true,
      })),
    };

    const resp = await fetch(`https://${SHOP}/admin/api/${VERSION}/orders.json`, {
      method:  "POST",
      headers: { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" },
      body:    JSON.stringify({ order: shopifyOrder }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: resp.status });
    }

    const data  = await resp.json() as { order: ShopifyOrderRaw };
    const order = normalizeOrder(data.order);
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
