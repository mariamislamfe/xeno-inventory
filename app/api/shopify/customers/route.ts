import { NextResponse } from "next/server";
import { getShopifyCustomers } from "@/lib/shopify/customers";

export const revalidate = 0;

export async function GET() {
  try {
    const customers = await getShopifyCustomers();
    return NextResponse.json({ customers, count: customers.length });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
