import type { Product } from "../types";

// Placeholder data — will be replaced by Shopify Products API sync
export const mockProducts: Product[] = [
  {
    id: "prod-001",
    name: "منتج تجريبي أ",
    description: "هذا المنتج سيتم استبداله بمنتجات Shopify عند الربط",
    sku: "SKU-001",
    category: "عام",
    price: 500,
    inventory: 20,
    status: "active",
    images: [],
    totalSales: 3,
    createdAt: "2025-08-01T00:00:00Z",
  },
  {
    id: "prod-002",
    name: "منتج تجريبي ب",
    description: "هذا المنتج سيتم استبداله بمنتجات Shopify عند الربط",
    sku: "SKU-002",
    category: "عام",
    price: 1200,
    inventory: 5,
    status: "active",
    images: [],
    totalSales: 1,
    createdAt: "2025-08-05T00:00:00Z",
  },
];

export const PRODUCT_CATEGORIES = ["عام"];
