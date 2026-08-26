import { mockInventory } from "@/lib/mock/inventory";
import { mockInventoryStats, type InventoryStats } from "@/lib/mock/inventory-stats";
import { mockTransactions } from "@/lib/mock/transactions";
import type { InventoryItem, InventoryTransaction } from "@/lib/types";

// Future: Supabase aggregate query
export async function getInventoryStats(): Promise<InventoryStats> {
  return mockInventoryStats;
}

// Future: SELECT * FROM inventory WHERE status = 'out_of_stock' ORDER BY last_updated DESC
export async function getOutOfStockItems(): Promise<InventoryItem[]> {
  return mockInventory.filter((i) => i.status === "out_of_stock");
}

// Future: SELECT * FROM inventory WHERE status = 'low_stock' ORDER BY current_stock ASC
export async function getLowStockItems(): Promise<InventoryItem[]> {
  return mockInventory.filter((i) => i.status === "low_stock");
}

// Future: SELECT name, sku, current_stock, min_stock FROM inventory ORDER BY current_stock DESC
export async function getProductStockLevels(): Promise<
  { name: string; sku: string; stock: number; minStock: number }[]
> {
  return mockInventory.map((item) => ({
    name:     item.productName,
    sku:      item.sku,
    stock:    item.currentStock,
    minStock: item.minStock,
  }));
}

// Future: SELECT category, SUM(current_stock) FROM inventory GROUP BY category
export async function getCategoryStockLevels(): Promise<
  { category: string; stock: number; minStock: number }[]
> {
  const map = new Map<string, { stock: number; minStock: number }>();
  for (const item of mockInventory) {
    const existing = map.get(item.category) ?? { stock: 0, minStock: 0 };
    map.set(item.category, {
      stock:    existing.stock    + item.currentStock,
      minStock: existing.minStock + item.minStock,
    });
  }
  return Array.from(map.entries()).map(([category, v]) => ({
    category, ...v,
  }));
}

// Future: SELECT * FROM inventory_transactions ORDER BY created_at DESC LIMIT n
export async function getRecentTransactions(limit = 5): Promise<InventoryTransaction[]> {
  return mockTransactions.slice(0, limit);
}

export async function getAllInventory(): Promise<InventoryItem[]> {
  return mockInventory;
}
