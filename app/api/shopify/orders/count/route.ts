import { NextRequest, NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify/client";

export const revalidate = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const status             = sp.get("status") ?? "any";
    const financial_status   = sp.get("financial_status") ?? "";
    const fulfillment_status = sp.get("fulfillment_status") ?? "";

    let qs = `status=${status}`;
    if (financial_status)   qs += `&financial_status=${financial_status}`;
    if (fulfillment_status) qs += `&fulfillment_status=${fulfillment_status}`;

    const data = await shopifyFetch<{ count: number }>(`/orders/count.json?${qs}`);
    return NextResponse.json({ count: data.count });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
