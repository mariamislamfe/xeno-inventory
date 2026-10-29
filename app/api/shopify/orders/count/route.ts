import { NextRequest, NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify/client";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const status             = sp.get("status") ?? "any";
    const financial_status   = sp.get("financial_status") ?? "";
    const fulfillment_status = sp.get("fulfillment_status") ?? "";
    const tag                = sp.get("tag") ?? "";
    const created_at_min     = sp.get("created_at_min") ?? "";
    const created_at_max     = sp.get("created_at_max") ?? "";

    let qs = `status=${status}`;
    if (financial_status)   qs += `&financial_status=${financial_status}`;
    if (fulfillment_status) qs += `&fulfillment_status=${fulfillment_status}`;
    if (tag)                qs += `&tag=${encodeURIComponent(tag)}`;
    if (created_at_min)     qs += `&created_at_min=${encodeURIComponent(created_at_min)}`;
    if (created_at_max)     qs += `&created_at_max=${encodeURIComponent(created_at_max)}`;

    const data = await shopifyFetch<{ count: number }>(`/orders/count.json?${qs}`);
    return NextResponse.json({ count: data.count });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
