import { shopifyFetch } from "./client";

// ── Shopify raw types ───────────────────────────────────────────────────
interface ShopifyCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  state: string; // "enabled" | "disabled"
  tags: string;
  default_address?: {
    address1: string;
    city: string;
    province: string;
    country: string;
  };
  created_at: string;
  updated_at: string;
}

// ── Normalized type ─────────────────────────────────────────────────────
export interface XenoCustomer {
  id: string;
  shopifyId: number;
  name: string;
  email: string;
  phone: string;
  ordersCount: number;
  totalSpent: number;
  status: "active" | "inactive";
  city: string;
  governorate: string;
  tags: string[];
  createdAt: string;
}

export function normalizeCustomer(c: ShopifyCustomer): XenoCustomer {
  return {
    id:          String(c.id),
    shopifyId:   c.id,
    name:        `${c.first_name} ${c.last_name}`.trim() || c.email,
    email:       c.email,
    phone:       c.phone ?? "",
    ordersCount: c.orders_count,
    totalSpent:  parseFloat(c.total_spent),
    status:      c.state === "enabled" ? "active" : "inactive",
    city:        c.default_address?.city ?? "",
    governorate: c.default_address?.province ?? "",
    tags:        c.tags ? c.tags.split(",").map((t) => t.trim()) : [],
    createdAt:   c.created_at,
  };
}

// ── API functions ───────────────────────────────────────────────────────

export async function getShopifyCustomers(limit = 100): Promise<XenoCustomer[]> {
  const data = await shopifyFetch<{ customers: ShopifyCustomer[] }>(
    `/customers.json?limit=${limit}`
  );
  return data.customers.map(normalizeCustomer);
}

export async function getShopifyCustomer(id: string): Promise<XenoCustomer | null> {
  try {
    const data = await shopifyFetch<{ customer: ShopifyCustomer }>(
      `/customers/${id}.json`
    );
    return normalizeCustomer(data.customer);
  } catch {
    return null;
  }
}
