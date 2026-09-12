import React from "react";
import { notFound } from "next/navigation";
import { normalizeOrder } from "@/lib/shopify/orders";
import type { ShopifyOrderRaw } from "@/lib/shopify/orders";
import { PrintLabelClient } from "./PrintLabelClient";

export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = await params;
  const SHOP    = process.env.SHOPIFY_SHOP;
  const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
  const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

  if (!SHOP || !TOKEN) notFound();

  let order;
  try {
    const resp = await fetch(
      `https://${SHOP}/admin/api/${VERSION}/orders/${id}.json`,
      { headers: { "X-Shopify-Access-Token": TOKEN }, cache: "no-store" }
    );
    if (!resp.ok) notFound();
    const data = await resp.json() as { order: ShopifyOrderRaw };
    order = normalizeOrder(data.order);
  } catch {
    notFound();
  }

  return <PrintLabelClient order={order} />;
}
