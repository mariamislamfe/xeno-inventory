import { shopifyFetch, shopifyPost } from "./client";

// ── Shopify raw types ───────────────────────────────────────────────────
export interface ShopifyAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  country: string;
  phone: string | null;
}

interface ShopifyLineItem {
  id: number;
  variant_id: number;
  product_id: number;
  title: string;
  variant_title: string | null;
  sku: string;
  quantity: number;
  price: string;
}

interface ShopifyFulfillment {
  id: number;
  status: string;
  tracking_number: string | null;
  tracking_company: string | null;
  created_at: string;
}

export interface ShopifyOrderRaw {
  id: number;
  order_number: number;
  name: string; // "#1001"
  email: string;
  phone: string | null;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  note: string | null;
  tags: string;
  billing_address: ShopifyAddress | null;
  shipping_address: ShopifyAddress | null;
  line_items: ShopifyLineItem[];
  fulfillments: ShopifyFulfillment[];
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
}

// ── Normalized type (used in XENO) ─────────────────────────────────────
export interface XenoOrder {
  id: string;
  shopifyId: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  email: string;
  address: string;
  city: string;
  governorate: string;
  status: "pending" | "processing" | "delivered" | "cancelled" | "returned";
  paymentStatus: "paid" | "unpaid" | "partial" | "refunded";
  total: number;
  items: {
    id: string;
    productName: string;
    variant: string;
    sku: string;
    quantity: number;
    price: number;
  }[];
  trackingNumber?: string;
  shippingProvider?: string;
  note?: string;
  tags: string[];
  createdAt: string;
}

function mapStatus(o: ShopifyOrderRaw): XenoOrder["status"] {
  if (o.cancelled_at) return "cancelled";
  if (o.fulfillment_status === "fulfilled") return "delivered";
  if (o.fulfillment_status === "partial") return "processing";
  return "pending";
}

function mapPayment(s: string): XenoOrder["paymentStatus"] {
  const m: Record<string, XenoOrder["paymentStatus"]> = {
    paid:       "paid",
    unpaid:     "unpaid",
    partially_paid: "partial",
    refunded:   "refunded",
    partially_refunded: "partial",
  };
  return m[s] ?? "unpaid";
}

export function normalizeOrder(o: ShopifyOrderRaw): XenoOrder {
  const addr   = o.shipping_address ?? o.billing_address;
  const firstName = addr?.first_name ?? "";
  const lastName  = addr?.last_name  ?? "";

  const fulfillment = o.fulfillments?.[0];

  return {
    id:          String(o.id),
    shopifyId:   o.id,
    orderNumber: o.name,
    customerName: `${firstName} ${lastName}`.trim() || o.email,
    customerPhone: addr?.phone ?? o.phone ?? "",
    email:       o.email,
    address:     addr?.address1 ?? "",
    city:        addr?.city ?? "",
    governorate: addr?.province ?? "",
    status:      mapStatus(o),
    paymentStatus: mapPayment(o.financial_status),
    total:       parseFloat(o.total_price),
    items:       o.line_items.map((li) => ({
      id:          String(li.id),
      productName: li.title,
      variant:     li.variant_title ?? "",
      sku:         li.sku,
      quantity:    li.quantity,
      price:       parseFloat(li.price),
    })),
    trackingNumber:   fulfillment?.tracking_number ?? undefined,
    shippingProvider: fulfillment?.tracking_company ?? undefined,
    note:  o.note ?? undefined,
    tags:  o.tags ? o.tags.split(",").map((t) => t.trim()) : [],
    createdAt: o.created_at,
  };
}

// ── API functions ───────────────────────────────────────────────────────

export async function getShopifyOrders(limit = 50): Promise<XenoOrder[]> {
  const data = await shopifyFetch<{ orders: ShopifyOrderRaw[] }>(
    `/orders.json?limit=${limit}&status=any`
  );
  return data.orders.map(normalizeOrder);
}

export async function getShopifyOrder(id: string): Promise<XenoOrder | null> {
  try {
    const data = await shopifyFetch<{ order: ShopifyOrderRaw }>(`/orders/${id}.json`);
    return normalizeOrder(data.order);
  } catch {
    return null;
  }
}

export async function updateShopifyOrderTags(
  shopifyId: number,
  tags: string[]
): Promise<void> {
  await shopifyPost(`/orders/${shopifyId}.json`, {
    order: { id: shopifyId, tags: tags.join(",") },
  });
}
