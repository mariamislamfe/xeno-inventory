import { NextRequest, NextResponse } from "next/server";

const SHOP    = process.env.SHOPIFY_SHOP;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

// Fallback rates when Shopify has no shipping zones configured.
// Override via env vars: DEFAULT_SHIPPING_COST / DEFAULT_SHIPPING_TITLE
// or per-governorate: SHIPPING_CAIRO=45, SHIPPING_OTHER=70
const DEFAULT_COST  = parseFloat(process.env.DEFAULT_SHIPPING_COST  ?? "0");
const DEFAULT_TITLE = process.env.DEFAULT_SHIPPING_TITLE ?? "الشحن";

// Per-governorate overrides (English province names from Shopify)
const PROVINCE_RATES: Record<string, number> = {
  Cairo:         parseFloat(process.env.SHIPPING_CAIRO       ?? String(DEFAULT_COST)),
  Giza:          parseFloat(process.env.SHIPPING_GIZA        ?? String(DEFAULT_COST)),
  Alexandria:    parseFloat(process.env.SHIPPING_ALEX        ?? String(DEFAULT_COST)),
  Qalyubia:      parseFloat(process.env.SHIPPING_QALYUBIA    ?? String(DEFAULT_COST)),
};

function fallbackRate(province: string): { rate: number; title: string } {
  const specific = PROVINCE_RATES[province];
  if (specific != null && specific > 0) return { rate: specific, title: DEFAULT_TITLE };
  if (DEFAULT_COST > 0)                 return { rate: DEFAULT_COST, title: DEFAULT_TITLE };
  return { rate: 0, title: "" };
}

interface ShopifyProvince  { code: string; name: string; shipping_zone_id: number }
interface ShopifyCountry   { code: string; provinces: ShopifyProvince[] }
interface ShopifyPriceRate { name: string; price: string; min_order_subtotal: string | null; max_order_subtotal: string | null }
interface ShopifyZone {
  id: number;
  name: string;
  countries: ShopifyCountry[];
  price_based_shipping_rates: ShopifyPriceRate[];
}

export const revalidate = 300; // cache 5 min

export async function GET(req: NextRequest) {
  const province   = req.nextUrl.searchParams.get("province") ?? "";
  const orderTotal = parseFloat(req.nextUrl.searchParams.get("total") ?? "0");

  // No Shopify credentials — return env-var fallback directly
  if (!SHOP || !TOKEN) return NextResponse.json(fallbackRate(province));

  try {
    const resp = await fetch(
      `https://${SHOP}/admin/api/${VERSION}/shipping_zones.json`,
      { headers: { "X-Shopify-Access-Token": TOKEN }, cache: "no-store" }
    );

    if (!resp.ok) {
      console.warn(`[shipping-rates] Shopify zones error ${resp.status}`);
      return NextResponse.json(fallbackRate(province));
    }

    const data  = await resp.json() as { shipping_zones: ShopifyZone[] };
    const zones = data.shipping_zones ?? [];

    console.log(`[shipping-rates] province="${province}" total=${orderTotal} zones=${zones.length} names=${zones.map(z => z.name).join(",")}`);

    // Find zone(s) covering Egypt
    const egyptZones = zones.filter((z) => z.countries.some((c) => c.code === "EG"));

    if (!egyptZones.length) {
      console.warn("[shipping-rates] no Egypt zone — using fallback");
      return NextResponse.json({ ...fallbackRate(province), source: "fallback" });
    }

    // Prefer province-specific zone, then whole-country zone
    let bestZone: ShopifyZone | null = null;
    for (const zone of egyptZones) {
      const egypt = zone.countries.find((c) => c.code === "EG");
      if (!egypt) continue;
      const hasProvince = egypt.provinces.some(
        (p) => p.name.toLowerCase() === province.toLowerCase()
      );
      if (hasProvince)                       { bestZone = zone; break; }
      if (!egypt.provinces.length && !bestZone) bestZone = zone;
    }
    if (!bestZone) bestZone = egyptZones[0];

    // Find price-based rate matching the order total
    const rates = bestZone.price_based_shipping_rates ?? [];
    let applicableRate: ShopifyPriceRate | null = null;
    for (const r of rates) {
      const min = r.min_order_subtotal != null ? parseFloat(r.min_order_subtotal) : 0;
      const max = r.max_order_subtotal != null ? parseFloat(r.max_order_subtotal) : Infinity;
      if (orderTotal >= min && orderTotal <= max) { applicableRate = r; break; }
    }
    if (!applicableRate && rates.length) applicableRate = rates[0];

    console.log(`[shipping-rates] zone="${bestZone.name}" rates=${rates.length} match="${applicableRate?.name}" price="${applicableRate?.price}"`);

    if (!applicableRate) {
      console.warn("[shipping-rates] no price rate in zone — using fallback");
      return NextResponse.json({ ...fallbackRate(province), source: "fallback" });
    }

    return NextResponse.json({
      rate:   parseFloat(applicableRate.price),
      title:  applicableRate.name,
      source: "shopify",
    });
  } catch (err) {
    console.error("[shipping-rates] error:", err);
    return NextResponse.json(fallbackRate(province));
  }
}
