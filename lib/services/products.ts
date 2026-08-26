import { mockProducts } from "../mock/products";
import type { Product, ProductStatus } from "../types";

export interface ProductFilters {
  search?: string;
  category?: string;
  status?: ProductStatus | "";
}

export async function getProducts(
  filters?: ProductFilters,
  page = 1,
  pageSize = 12
) {
  let filtered = [...mockProducts];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  if (filters?.category) {
    filtered = filtered.filter((p) => p.category === filters.category);
  }

  if (filters?.status) {
    filtered = filtered.filter((p) => p.status === filters.status);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return { data, total, page, pageSize, totalPages };
}

export async function getProductById(id: string): Promise<Product | null> {
  return mockProducts.find((p) => p.id === id) ?? null;
}
