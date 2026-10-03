import { NextResponse } from "next/server";

const SHOP    = process.env.SHOPIFY_SHOP!;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN!;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

function h() { return { "X-Shopify-Access-Token": TOKEN }; }

export const revalidate = 0;

export async function GET() {
  const [custResp, countResp, zonesResp] = await Promise.all([
    fetch(`https://${SHOP}/admin/api/${VERSION}/customers.json?limit=5&order=updated_at+DESC`, { headers: h() }),
    fetch(`https://${SHOP}/admin/api/${VERSION}/customers/count.json`, { headers: h() }),
    fetch(`https://${SHOP}/admin/api/${VERSION}/shipping_zones.json`, { headers: h() }),
  ]);

  const [custData, countData, zonesData] = await Promise.all([
    custResp.json(),
    countResp.json(),
    zonesResp.json(),
  ]);

  return NextResponse.json({
    customers_count:   countData,
    customers_sample:  custData,
    shipping_zones:    zonesData,
    status: { customers: custResp.status, count: countResp.status, zones: zonesResp.status },
  });
}
