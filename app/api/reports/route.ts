import { NextRequest, NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify/client";

export const revalidate = 0;

interface ShopifyOrderLite {
  id: number;
  order_number: number;
  total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  tags: string;
  created_at: string;
  customer?: { id: number };
}

const FIELDS = "id,order_number,total_price,financial_status,fulfillment_status,tags,created_at,customer";

async function fetchAllOrders(startDate: Date): Promise<ShopifyOrderLite[]> {
  const all: ShopifyOrderLite[] = [];
  let sinceId: number | undefined;

  while (true) {
    const base = `/orders.json?status=any&created_at_min=${startDate.toISOString()}&limit=250&fields=${FIELDS}`;
    const url  = sinceId ? `${base}&since_id=${sinceId}` : base;
    const data = await shopifyFetch<{ orders: ShopifyOrderLite[] }>(url);
    const page = data.orders ?? [];
    all.push(...page);
    if (page.length < 250) break;
    sinceId = page[page.length - 1].id;
  }

  return all;
}

// GET /api/reports?period=week|month|3months
export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "month") as "week" | "month" | "3months";

  const now = new Date();
  const startDate = new Date(now);
  if (period === "week")    startDate.setDate(now.getDate() - 7);
  else if (period === "month") startDate.setMonth(now.getMonth() - 1);
  else                     startDate.setMonth(now.getMonth() - 3);

  try {
    const orders = await fetchAllOrders(startDate);

    // Daily buckets
    const buckets = new Map<string, { sales: number; orders: number }>();
    // Fill all days in range
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const key = formatBucketKey(d, period);
      if (!buckets.has(key)) buckets.set(key, { sales: 0, orders: 0 });
    }

    const uniqueCustomers = new Set<number>();
    let totalSales = 0;

    for (const o of orders) {
      const amt = parseFloat(o.total_price ?? "0");
      totalSales += amt;
      const d = new Date(o.created_at);
      const key = formatBucketKey(d, period);
      const bucket = buckets.get(key) ?? { sales: 0, orders: 0 };
      bucket.sales  += amt;
      bucket.orders += 1;
      buckets.set(key, bucket);
      if (o.customer?.id) uniqueCustomers.add(o.customer.id);
    }

    const chartData = Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      sales:  Math.round(v.sales),
      orders: v.orders,
    }));

    // Order status distribution
    const statusMap = new Map<string, number>();
    for (const o of orders) {
      const s = deriveStatus(o);
      statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
    }
    const statusData = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

    return NextResponse.json({
      chartData,
      statusData,
      summary: {
        totalSales:         Math.round(totalSales),
        totalOrders:        orders.length,
        averageOrderValue:  orders.length > 0 ? Math.round(totalSales / orders.length) : 0,
        newCustomers:       uniqueCustomers.size,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function formatBucketKey(d: Date, period: "week" | "month" | "3months"): string {
  if (period === "3months") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function deriveStatus(o: ShopifyOrderLite): string {
  if (o.financial_status === "refunded" || o.tags?.includes("مرتجع")) return "returned";
  if (o.financial_status === "voided") return "cancelled";
  if (o.fulfillment_status === "fulfilled") return "delivered";
  if (o.fulfillment_status === "partial") return "in_delivery";
  if (o.tags?.includes("تم الشحن") || o.tags?.includes("shipped")) return "sent_to_shipping";
  if (o.financial_status === "paid") return "processing";
  return "new";
}
