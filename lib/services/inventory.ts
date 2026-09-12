import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/client";
import { getShopifyProducts } from "@/lib/shopify/products";
import type { InventoryItem, InventoryTransaction } from "@/lib/types";

// Deduplicate concurrent Shopify product fetches within the same React render
const getCachedProducts = cache((limit: number) => getShopifyProducts(limit));

export interface InventoryStats {
  totalSkus: number;
  totalSkusDelta: number;
  totalValue: number;
  totalValueDelta: number;
  totalCost: number;
  totalCostDelta: number;
  outOfStock: number;
  outOfStockDelta: number;
  lowStock: number;
  lowStockDelta: number;
}

export async function getInventoryStats(): Promise<InventoryStats> {
  try {
    const products = await getCachedProducts(250);
    const outOfStock = products.filter((p) => p.status === "out_of_stock").length;
    const lowStock   = products.filter((p) => p.status === "low_stock").length;
    const totalValue = products.reduce((s, p) => s + p.price * p.stock, 0);
    const totalCost  = products.reduce((s, p) => s + p.costPrice * p.stock, 0);
    return {
      totalSkus: products.length, totalSkusDelta: 0,
      totalValue, totalValueDelta: 0,
      totalCost, totalCostDelta: 0,
      outOfStock, outOfStockDelta: 0,
      lowStock, lowStockDelta: 0,
    };
  } catch {
    return { totalSkus: 0, totalSkusDelta: 0, totalValue: 0, totalValueDelta: 0,
      totalCost: 0, totalCostDelta: 0, outOfStock: 0, outOfStockDelta: 0, lowStock: 0, lowStockDelta: 0 };
  }
}

export async function getOutOfStockItems(): Promise<InventoryItem[]> {
  try {
    const products = await getCachedProducts(250);
    return products.filter((p) => p.status === "out_of_stock").map(productToItem);
  } catch { return []; }
}

export async function getLowStockItems(): Promise<InventoryItem[]> {
  try {
    const products = await getCachedProducts(250);
    return products.filter((p) => p.status === "low_stock").map(productToItem);
  } catch { return []; }
}

export async function getProductStockLevels(): Promise<{ name: string; sku: string; stock: number; minStock: number }[]> {
  try {
    const products = await getCachedProducts(50);
    return products.slice(0, 15).map((p) => ({
      name:     p.name,
      sku:      p.sku,
      stock:    p.stock,
      minStock: p.minStock,
    }));
  } catch { return []; }
}

export async function getCategoryStockLevels(): Promise<{ category: string; stock: number; minStock: number }[]> {
  try {
    const products = await getCachedProducts(250);
    const map = new Map<string, { stock: number; minStock: number }>();
    for (const p of products) {
      const existing = map.get(p.category) ?? { stock: 0, minStock: 0 };
      map.set(p.category, { stock: existing.stock + p.stock, minStock: existing.minStock + p.minStock });
    }
    return Array.from(map.entries()).map(([category, v]) => ({ category, ...v }));
  } catch { return []; }
}

export async function getRecentTransactions(limit = 5): Promise<InventoryTransaction[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("inventory_transactions")
      .select("id, type, sku, product_name, category, quantity, note, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []).map((row) => ({
      id:          row.id,
      type:        row.type as "in" | "out",
      sku:         row.sku,
      productName: row.product_name,
      category:    row.category ?? "عام",
      quantity:    row.quantity,
      note:        row.note ?? undefined,
      createdAt:   row.created_at,
      createdBy:   row.created_by ?? "النظام",
    }));
  } catch { return []; }
}

export async function getAllInventory(): Promise<InventoryItem[]> {
  try {
    const products = await getCachedProducts(250);
    return products.map(productToItem);
  } catch { return []; }
}

function productToItem(p: { id: string; shopifyId: number; name: string; image?: string; sku: string; category: string; price: number; costPrice: number; stock: number; minStock: number; status: "in_stock" | "low_stock" | "out_of_stock"; createdAt: string }): InventoryItem {
  return {
    id:             p.id,
    productId:      p.id,
    productName:    p.name,
    productImage:   p.image,
    sku:            p.sku,
    category:       p.category,
    currentStock:   p.stock,
    minStock:       p.minStock,
    unitCost:       p.costPrice,
    unitPrice:      p.price,
    totalValue:     p.price * p.stock,
    status:         p.status,
    lastUpdated:    p.createdAt,
  };
}
