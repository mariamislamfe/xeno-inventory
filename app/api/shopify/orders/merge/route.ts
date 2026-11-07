import { NextRequest, NextResponse } from "next/server";
import { mergeOrders } from "@/lib/merge-server";

export const maxDuration = 60;

// POST /api/shopify/orders/merge
// Body: { shopifyIds: number[] }  — must be 2+ unfulfilled orders from same customer
export async function POST(req: NextRequest) {
  let shopifyIds: number[];
  try {
    ({ shopifyIds } = await req.json() as { shopifyIds: number[] });
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  if (!Array.isArray(shopifyIds) || shopifyIds.length < 2) {
    return NextResponse.json({ error: "يلزم طلبان على الأقل" }, { status: 400 });
  }
  const { status, body } = await mergeOrders(shopifyIds);
  return NextResponse.json(body, { status });
}
