import { NextResponse } from "next/server";
import { getShopifyOrders } from "@/lib/shopify/orders";

export const revalidate = 0;

export async function GET() {
  try {
    const orders = await getShopifyOrders();
    return NextResponse.json({ orders, count: orders.length });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
