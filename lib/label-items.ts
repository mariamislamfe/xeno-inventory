// Server-only: the items table printed under the J&T waybill.
import { supabaseAdmin } from "@/lib/supabase/client";

export interface LabelItem { qty: number; name: string; color: string; size: string; sku: string }

const SIZE_RE = /^(\d?X{0,3}[SML]|X{1,3}L|\d+XL|\d{1,3}(\.\d)?|free ?size|one ?size|فري ?سايز|مقاس.*)$/i;

// Shopify variant titles look like "Black / L" — pick the part that looks like a size
export function splitVariant(variant: string): { color: string; size: string } {
  const parts = (variant ?? "").split("/").map((p) => p.trim()).filter((p) => p && p !== "Default Title");
  const size  = parts.find((p) => SIZE_RE.test(p)) ?? "";
  const color = parts.filter((p) => p !== size).join(" / ");
  return { color, size };
}

export async function getLabelItems(shopifyOrderId: number): Promise<LabelItem[]> {
  // Items edited in the dashboard win over Shopify's line items (same as shipping)
  const { data: op } = await supabaseAdmin
    .from("xeno_ops")
    .select("items_override")
    .eq("shopify_order_id", shopifyOrderId)
    .maybeSingle();
  const override = op?.items_override as { name: string; qty: number; sku?: string; variant?: string }[] | null;
  if (override?.length) {
    return override.map((i) => ({ qty: i.qty, name: i.name, sku: i.sku ?? "", ...splitVariant(i.variant ?? "") }));
  }

  const shop    = process.env.SHOPIFY_SHOP;
  const token   = process.env.SHOPIFY_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";
  if (!shop || !token) return [];
  try {
    const res = await fetch(
      `https://${shop}/admin/api/${version}/orders/${shopifyOrderId}.json?fields=line_items`,
      { headers: { "X-Shopify-Access-Token": token }, cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json() as { order?: { line_items?: { title: string; quantity: number; sku?: string | null; variant_title?: string | null }[] } };
    return (data.order?.line_items ?? []).map((li) => ({
      qty:  li.quantity,
      name: li.title,
      sku:  li.sku ?? "",
      ...splitVariant(li.variant_title ?? ""),
    }));
  } catch {
    return [];
  }
}
