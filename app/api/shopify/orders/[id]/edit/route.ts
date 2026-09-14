import { NextRequest, NextResponse } from "next/server";
import { editShopifyOrderItems } from "@/lib/shopify/order-edit";
import type { EditItemInput, OriginalItemInput } from "@/lib/shopify/order-edit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const shopifyOrderId = parseInt(id);
  if (isNaN(shopifyOrderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  if (!process.env.SHOPIFY_SHOP || !process.env.SHOPIFY_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Shopify not configured" }, { status: 503 });
  }

  const body = await req.json() as {
    items: EditItemInput[];
    originalItems: OriginalItemInput[];
    staffNote?: string;
  };

  if (!body.items?.length) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }

  const result = await editShopifyOrderItems(
    shopifyOrderId,
    body.originalItems ?? [],
    body.items,
    body.staffNote,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
