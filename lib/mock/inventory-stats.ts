export interface InventoryStats {
  totalValue: number;
  totalValueDelta: number;
  totalCost: number;
  totalCostDelta: number;
  totalSkus: number;
  totalSkusDelta: number;
  outOfStock: number;
  outOfStockDelta: number;
  lowStock: number;
  lowStockDelta: number;
  lastTransactionHoursAgo: number;
}

// Calculated from mockInventory (current_stock × avg_price)
// Future: replaced by Supabase aggregate query
export const mockInventoryStats: InventoryStats = {
  totalValue:      734_400,   // 1460 units × avg 503 EGP
  totalValueDelta: 12_800,
  totalCost:       367_200,   // 1460 units × avg 251 EGP
  totalCostDelta:  6_400,
  totalSkus:       14,
  totalSkusDelta:  2,
  outOfStock:      3,         // BNT-0018, TSH-0009, JAK-0002
  outOfStockDelta: 1,
  lowStock:        4,         // BNT-0019, TSH-0010, FST-0004, SHR-0002
  lowStockDelta:   1,
  lastTransactionHoursAgo: 2,
};
