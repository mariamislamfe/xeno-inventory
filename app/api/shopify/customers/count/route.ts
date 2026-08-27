import { NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify/client";

export const revalidate = 60;

export async function GET() {
  try {
    const data = await shopifyFetch<{ count: number }>("/customers/count.json");
    return NextResponse.json({ count: data.count });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
