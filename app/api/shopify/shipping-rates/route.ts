import { NextRequest, NextResponse } from "next/server";

const SHOP    = process.env.SHOPIFY_SHOP;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

const DEFAULT_COST  = parseFloat(process.env.DEFAULT_SHIPPING_COST  ?? "0");
const DEFAULT_TITLE = process.env.DEFAULT_SHIPPING_TITLE ?? "الشحن";

// Extract price from zone name e.g. "60EGP" → 60, "90EGP" → 90
function priceFromZoneName(name: string): number {
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

interface ShopifyProvince  { code: string; name: string }
interface ShopifyCountry   { code: string; provinces: ShopifyProvince[] }
interface ShopifyPriceRate { name: string; price: string; min_order_subtotal: string | null; max_order_subtotal: string | null }
interface ShopifyWeightRate { name: string; price: string; weight_low: number; weight_high: number }
interface ShopifyZone {
  id: number;
  name: string;
  countries: ShopifyCountry[];
  price_based_shipping_rates: ShopifyPriceRate[];
  weight_based_shipping_rates?: ShopifyWeightRate[];
}

// "Kafr el-Sheikh" / "Kafr El Sheikh" / "kafrelsheikh" → same key
const provKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const province   = req.nextUrl.searchParams.get("province") ?? "";
  const orderTotal = parseFloat(req.nextUrl.searchParams.get("total") ?? "0");

  if (!SHOP || !TOKEN) {
    return NextResponse.json({ rate: DEFAULT_COST, title: DEFAULT_TITLE });
  }

  try {
    const resp = await fetch(
      `https://${SHOP}/admin/api/${VERSION}/shipping_zones.json`,
      { headers: { "X-Shopify-Access-Token": TOKEN }, cache: "no-store" }
    );
    if (!resp.ok) {
      return NextResponse.json({ rate: DEFAULT_COST, title: DEFAULT_TITLE });
    }

    const data  = await resp.json() as { shipping_zones: ShopifyZone[] };
    const zones = data.shipping_zones ?? [];

    // Find zones covering Egypt
    const egyptZones = zones.filter((z) => z.countries.some((c) => c.code === "EG"));
    if (!egyptZones.length) {
      return NextResponse.json({ rate: DEFAULT_COST, title: DEFAULT_TITLE });
    }

    // Find which zone covers the requested province
    let matchedZone: ShopifyZone | null = null;
    let fallbackZone: ShopifyZone | null = null;

    for (const zone of egyptZones) {
      const egypt = zone.countries.find((c) => c.code === "EG");
      if (!egypt) continue;

      if (egypt.provinces.length === 0) {
        // Whole-country zone
        if (!fallbackZone) fallbackZone = zone;
        continue;
      }

      const hit = egypt.provinces.some(
        (p) => provKey(p.name) === provKey(province) || p.code.toLowerCase() === province.toLowerCase()
      );
      if (hit) { matchedZone = zone; break; }
    }

    const bestZone = matchedZone ?? fallbackZone ?? egyptZones[0];

    // Try price_based_shipping_rates first
    const rates = bestZone.price_based_shipping_rates ?? [];
    let ratePrice = 0;
    let rateTitle = DEFAULT_TITLE;

    const weightRates = bestZone.weight_based_shipping_rates ?? [];
    if (rates.length > 0) {
      // Like checkout: of the rates this order total qualifies for (e.g. a free
      // shipping rate above some amount), the cheapest one
      const fits = rates.filter((r) => {
        const min = r.min_order_subtotal != null ? parseFloat(r.min_order_subtotal) : 0;
        const max = r.max_order_subtotal != null ? parseFloat(r.max_order_subtotal) : Infinity;
        return orderTotal >= min && orderTotal <= max;
      });
      const pool  = fits.length ? fits : rates;
      const match = pool.reduce((a, b) => (parseFloat(b.price) < parseFloat(a.price) ? b : a));
      ratePrice = parseFloat(match.price);
      rateTitle = match.name;
    } else if (weightRates.length > 0) {
      // Weight isn't known here — use the lightest bracket (a normal single parcel)
      const match = weightRates.reduce((a, b) => (b.weight_low < a.weight_low ? b : a));
      ratePrice = parseFloat(match.price);
      rateTitle = match.name;
    } else {
      // Rates not configured in Shopify — extract from zone name (e.g. "60EGP" → 60)
      ratePrice = priceFromZoneName(bestZone.name);
      rateTitle = DEFAULT_TITLE;
    }

    // Final fallback to env var if still zero
    if (ratePrice === 0 && DEFAULT_COST > 0) {
      ratePrice = DEFAULT_COST;
    }

    console.log(`[shipping-rates] province="${province}" zone="${bestZone.name}" matched=${!!matchedZone} rate=${ratePrice}`);

    return NextResponse.json({ rate: ratePrice, title: rateTitle });
  } catch (err) {
    console.error("[shipping-rates]", err);
    return NextResponse.json({ rate: DEFAULT_COST, title: DEFAULT_TITLE });
  }
}
