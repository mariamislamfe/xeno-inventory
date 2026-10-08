// Server-only: the items table printed under the J&T waybill.
import { supabaseAdmin } from "@/lib/supabase/client";
import { resolveJTAddress } from "@/lib/jt/address";
import { toLocal } from "@/lib/phone";
import { currentQty } from "@/lib/shopify/orders";

export interface LabelItem { qty: number; name: string; color: string; size: string; sku: string }
// Receiver as J&T has it: the street plus the area/city/province from J&T's table
export interface LabelReceiver { name: string; phone: string; street: string; place: string }

interface ShopifyLabelOrder {
  line_items?: { title: string; quantity: number; current_quantity?: number; sku?: string | null; variant_title?: string | null }[];
  shipping_address?: { first_name?: string; last_name?: string; phone?: string; address1?: string; city?: string; province?: string } | null;
}

const SIZE_RE = /^(\d?X{0,3}[SML]|X{1,3}L|\d+XL|\d{1,3}(\.\d)?|free ?size|one ?size|فري ?سايز|مقاس.*)$/i;

// Shopify variant titles look like "Black / L" — pick the part that looks like a size
export function splitVariant(variant: string): { color: string; size: string } {
  const parts = (variant ?? "").split("/").map((p) => p.trim()).filter((p) => p && p !== "Default Title");
  const size  = parts.find((p) => SIZE_RE.test(p)) ?? "";
  const color = parts.filter((p) => p !== size).join(" / ");
  return { color, size };
}

async function fetchShopifyOrder(id: number): Promise<ShopifyLabelOrder | null> {
  const shop    = process.env.SHOPIFY_SHOP;
  const token   = process.env.SHOPIFY_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";
  if (!shop || !token) return null;
  try {
    const res = await fetch(
      `https://${shop}/admin/api/${version}/orders/${id}.json?fields=line_items,shipping_address`,
      { headers: { "X-Shopify-Access-Token": token }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json() as { order?: ShopifyLabelOrder };
    return data.order ?? null;
  } catch {
    return null;
  }
}

export async function getLabelData(shopifyOrderId: number): Promise<{ items: LabelItem[]; receiver: LabelReceiver | null }> {
  const [order, op] = await Promise.all([
    fetchShopifyOrder(shopifyOrderId),
    supabaseAdmin.from("xeno_ops").select("items_override").eq("shopify_order_id", shopifyOrderId).maybeSingle(),
  ]);

  // Items edited in the dashboard win over Shopify's line items (same as shipping)
  const override = op.data?.items_override as { name: string; qty: number; sku?: string; variant?: string }[] | null;
  const items: LabelItem[] = override?.length
    ? override.map((i) => ({ qty: i.qty, name: i.name, sku: i.sku ?? "", ...splitVariant(i.variant ?? "") }))
    : (order?.line_items ?? []).filter((li) => currentQty(li) > 0).map((li) => ({
        qty:  currentQty(li),
        name: li.title,
        sku:  li.sku ?? "",
        ...splitVariant(li.variant_title ?? ""),
      }));

  let receiver: LabelReceiver | null = null;
  const a = order?.shipping_address;
  if (a) {
    // Same mapping the shipment was created with, so it matches what J&T printed
    const jt = resolveJTAddress({ governorate: a.province ?? a.city ?? "", city: a.city ?? "", address: a.address1 ?? "" });
    receiver = {
      name:   `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(),
      phone:  toLocal(a.phone ?? ""),
      street: a.address1 ?? "",
      place:  jt.ok ? [jt.area, jt.city, jt.prov].filter(Boolean).join("، ") : [a.city, a.province].filter(Boolean).join("، "),
    };
  }
  return { items, receiver };
}
