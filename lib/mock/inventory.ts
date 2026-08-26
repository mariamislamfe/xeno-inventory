import type { InventoryItem } from "../types";

// Placeholder — will sync from Shopify + Supabase on integration
export const mockInventory: InventoryItem[] = [
  // ────── بنطالين ──────
  {
    id: "inv-001", productId: "prod-001",
    productName: "بنطلون أوفرسايز أسود",
    sku: "BNT-0016", category: "بنطالين",
    currentStock: 200, minStock: 30, maxStock: 500,
    status: "in_stock",
    lastUpdated: "2025-08-19T09:00:00Z", location: "مستودع أ",
  },
  {
    id: "inv-002", productId: "prod-002",
    productName: "بنطلون أوفرسايز بيج",
    sku: "BNT-0017", category: "بنطالين",
    currentStock: 180, minStock: 30, maxStock: 500,
    status: "in_stock",
    lastUpdated: "2025-08-18T14:00:00Z", location: "مستودع أ",
  },
  {
    id: "inv-003", productId: "prod-003",
    productName: "بنطلون كاجوال رمادي",
    sku: "BNT-0018", category: "بنطالين",
    currentStock: 0, minStock: 20, maxStock: 300,
    status: "out_of_stock",
    lastUpdated: "2025-08-15T10:00:00Z", location: "مستودع أ",
  },
  {
    id: "inv-004", productId: "prod-004",
    productName: "بنطلون جينز سليم أسود",
    sku: "BNT-0019", category: "بنطالين",
    currentStock: 8, minStock: 20, maxStock: 300,
    status: "low_stock",
    lastUpdated: "2025-08-17T11:00:00Z", location: "مستودع أ",
  },

  // ────── تيشيرتات ──────
  {
    id: "inv-005", productId: "prod-005",
    productName: "تيشيرت أوفرسايز أبيض",
    sku: "TSH-0007", category: "تيشيرتات",
    currentStock: 350, minStock: 50, maxStock: 800,
    status: "in_stock",
    lastUpdated: "2025-08-19T08:30:00Z", location: "مستودع ب",
  },
  {
    id: "inv-006", productId: "prod-006",
    productName: "تيشيرت أوفرسايز أسود",
    sku: "TSH-0008", category: "تيشيرتات",
    currentStock: 400, minStock: 50, maxStock: 800,
    status: "in_stock",
    lastUpdated: "2025-08-19T08:30:00Z", location: "مستودع ب",
  },
  {
    id: "inv-007", productId: "prod-007",
    productName: "تيشيرت بيسيك رمادي",
    sku: "TSH-0009", category: "تيشيرتات",
    currentStock: 0, minStock: 30, maxStock: 500,
    status: "out_of_stock",
    lastUpdated: "2025-08-14T12:00:00Z", location: "مستودع ب",
  },
  {
    id: "inv-008", productId: "prod-008",
    productName: "تيشيرت بولو أزرق",
    sku: "TSH-0010", category: "تيشيرتات",
    currentStock: 12, minStock: 30, maxStock: 500,
    status: "low_stock",
    lastUpdated: "2025-08-16T09:00:00Z", location: "مستودع ب",
  },

  // ────── فساتين ──────
  {
    id: "inv-009", productId: "prod-009",
    productName: "فستان كاجوال أسود",
    sku: "FST-0003", category: "فساتين",
    currentStock: 95, minStock: 15, maxStock: 200,
    status: "in_stock",
    lastUpdated: "2025-08-18T10:00:00Z", location: "مستودع أ",
  },
  {
    id: "inv-010", productId: "prod-010",
    productName: "فستان صيفي بيج",
    sku: "FST-0004", category: "فساتين",
    currentStock: 4, minStock: 15, maxStock: 200,
    status: "low_stock",
    lastUpdated: "2025-08-17T14:00:00Z", location: "مستودع أ",
  },

  // ────── جاكيتات ──────
  {
    id: "inv-011", productId: "prod-011",
    productName: "جاكيت بيسيك أسود",
    sku: "JAK-0001", category: "جاكيتات",
    currentStock: 120, minStock: 20, maxStock: 300,
    status: "in_stock",
    lastUpdated: "2025-08-19T07:00:00Z", location: "مستودع ب",
  },
  {
    id: "inv-012", productId: "prod-012",
    productName: "جاكيت كاجوال رمادي",
    sku: "JAK-0002", category: "جاكيتات",
    currentStock: 0, minStock: 20, maxStock: 300,
    status: "out_of_stock",
    lastUpdated: "2025-08-13T16:00:00Z", location: "مستودع ب",
  },

  // ────── شورتات ──────
  {
    id: "inv-013", productId: "prod-013",
    productName: "شورت بيسيك أسود",
    sku: "SHR-0001", category: "شورتات",
    currentStock: 85, minStock: 15, maxStock: 200,
    status: "in_stock",
    lastUpdated: "2025-08-18T13:00:00Z", location: "مستودع أ",
  },
  {
    id: "inv-014", productId: "prod-014",
    productName: "شورت أوفرسايز بيج",
    sku: "SHR-0002", category: "شورتات",
    currentStock: 6, minStock: 15, maxStock: 200,
    status: "low_stock",
    lastUpdated: "2025-08-16T11:00:00Z", location: "مستودع أ",
  },
];

export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  in_stock:     "متوفر",
  low_stock:    "مخزون منخفض",
  out_of_stock: "نفد المخزون",
};
