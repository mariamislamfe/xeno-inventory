import { NextRequest, NextResponse } from "next/server";

const SHOP    = process.env.SHOPIFY_SHOP;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

// GET /api/shopify/orders/[id]/adjacent?dir=up|down&created_at=ISO
// up = the next newer order (above it in the list), down = the next older one.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SHOP || !TOKEN) return NextResponse.json({ error: "Shopify not configured" }, { status: 503 });

  const dir       = req.nextUrl.searchParams.get("dir");
  const createdAt = req.nextUrl.searchParams.get("created_at") ?? "";
  let qs: string;
  if (dir === "up") {
    qs = `since_id=${encodeURIComponent(id)}`;
  } else if (dir === "down" && createdAt) {
    const before = new Date(new Date(createdAt).getTime() - 1000).toISOString();
    qs = `created_at_max=${encodeURIComponent(before)}`;
  } else {
    return NextResponse.json({ error: "dir=up|down (down needs created_at)" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://${SHOP}/admin/api/${VERSION}/orders.json?status=any&limit=1&fields=id&${qs}`,
      { headers: { "X-Shopify-Access-Token": TOKEN }, cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ error: `Shopify ${res.status}` }, { status: res.status });
    const data = await res.json() as { orders: { id: number }[] };
    return NextResponse.json({ id: data.orders[0] ? String(data.orders[0].id) : null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
