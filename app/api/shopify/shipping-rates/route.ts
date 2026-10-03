import { NextRequest, NextResponse } from "next/server";

const SHOP    = process.env.SHOPIFY_SHOP;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

export const revalidate = 300; // cache 5 min

interface ShopifyProvince { code: string; name: string; shipping_zone_id: number }
interface ShopifyCountry  { code: string; provinces: ShopifyProvince[] }
interface ShopifyPriceRate { name: string; price: string; min_order_subtotal: string | null; max_order_subtotal: string | null }
interface ShopifyZone {
  id: number;
  name: string;
  countries: ShopifyCountry[];
  price_based_shipping_rates: ShopifyPriceRate[];
}

export async function GET(req: NextRequest) {
  if (!SHOP || !TOKEN) return NextResponse.json({ rate: 0, title: "" });

  const province   = req.nextUrl.searchParams.get("province") ?? "";
  const orderTotal = parseFloat(req.nextUrl.searchParams.get("total") ?? "0");

  try {
    const resp = await fetch(
      `https://${SHOP}/admin/api/${VERSION}/shipping_zones.json`,
      { headers: { "X-Shopify-Access-Token": TOKEN }, cache: "no-store" }
    );
    if (!resp.ok) return NextResponse.json({ rate: 0, title: "" });

    const data = await resp.json() as { shipping_zones: ShopifyZone[] };
    const zones = data.shipping_zones ?? [];

    console.log(`[shipping-rates] province="${province}" total=${orderTotal} zones=${zones.length} zone_names=${zones.map(z=>z.name).join(",")}`);

    // Find zones that cover Egypt (with or without province-level restriction)
    const egyptZones = zones.filter((z) =>
      z.countries.some((c) => c.code === "EG")
    );

    console.log(`[shipping-rates] egypt zones=${egyptZones.length}`);
    if (!egyptZones.length) return NextResponse.json({ rate: 0, title: "", debug: "no_egypt_zone" });

    // Try to find a zone that specifically targets this province
    // If province-level zone exists, prefer it over the general Egypt zone
    let bestZone: ShopifyZone | null = null;

    for (const zone of egyptZones) {
      const egypt = zone.countries.find((c) => c.code === "EG");
      if (!egypt) continue;
      // A zone with specific provinces listed covers only those provinces
      // A zone with 0 provinces in the array covers the whole country
      const hasProvince = egypt.provinces.some(
        (p) => p.name.toLowerCase() === province.toLowerCase()
      );
      if (hasProvince) { bestZone = zone; break; }
      if (!egypt.provinces.length && !bestZone) bestZone = zone; // whole-country fallback
    }

    if (!bestZone) bestZone = egyptZones[0]; // last resort

    // Find applicable price-based rate for the order total
    const rates = bestZone.price_based_shipping_rates;
    let applicableRate: ShopifyPriceRate | null = null;
    for (const r of rates) {
      const min = r.min_order_subtotal != null ? parseFloat(r.min_order_subtotal) : 0;
      const max = r.max_order_subtotal != null ? parseFloat(r.max_order_subtotal) : Infinity;
      if (orderTotal >= min && orderTotal <= max) { applicableRate = r; break; }
    }
    if (!applicableRate && rates.length) applicableRate = rates[0];

    console.log(`[shipping-rates] bestZone="${bestZone?.name}" rates=${rates.length} applicable="${applicableRate?.name}" price="${applicableRate?.price}"`);
    if (!applicableRate) return NextResponse.json({ rate: 0, title: "", debug: "no_rate_match" });

    return NextResponse.json({
      rate:  parseFloat(applicableRate.price),
      title: applicableRate.name,
    });
  } catch {
    return NextResponse.json({ rate: 0, title: "" });
  }
}
