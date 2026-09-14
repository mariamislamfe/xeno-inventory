import { shopifyFetch } from "./client";

const SHOP    = process.env.SHOPIFY_SHOP!;
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN!;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";
const BASE    = `https://${SHOP}/admin/api/${VERSION}`;

function extractNextUrl(link: string | null): string | null {
  if (!link) return null;
  const match = link.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

// ── Shopify raw types ───────────────────────────────────────────────────
interface ShopifyImage { src: string; alt: string | null }

interface ShopifyVariant {
  id: number;
  title: string;
  sku: string;
  price: string;
  compare_at_price: string | null;
  inventory_quantity: number;
  inventory_management: string | null;
  inventory_item_id: number;
  weight: number;
  weight_unit: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  handle: string;
  status: "active" | "archived" | "draft";
  tags: string;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  created_at: string;
  updated_at: string;
}

// ── Normalized type (used in XENO) ─────────────────────────────────────
export interface XenoProduct {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
  image?: string;
  shopifyId: number;
  variants: {
    id: number;
    title: string;
    sku: string;
    stock: number;
    price: number;
  }[];
  createdAt: string;
}

function stockStatus(qty: number, min = 10): XenoProduct["status"] {
  if (qty <= 0)   return "out_of_stock";
  if (qty <= min) return "low_stock";
  return "in_stock";
}

export function normalizeProduct(p: ShopifyProduct): XenoProduct {
  const mainVariant = p.variants[0];
  const totalStock  = p.variants.reduce((s, v) => s + (v.inventory_quantity ?? 0), 0);
  const price       = parseFloat(mainVariant?.price ?? "0");
  const sku         = mainVariant?.sku || `SHP-${p.id}`;

  return {
    id:         String(p.id),
    shopifyId:  p.id,
    name:       p.title,
    category:   p.product_type || p.vendor || "عام",
    sku,
    price,
    costPrice:  price * 0.5, // placeholder until cost metafield added
    stock:      totalStock,
    minStock:   10,
    status:     stockStatus(totalStock),
    image:      p.images[0]?.src,
    variants:   p.variants.map((v) => ({
      id:    v.id,
      title: v.title,
      sku:   v.sku || sku,
      stock: v.inventory_quantity ?? 0,
      price: parseFloat(v.price),
    })),
    createdAt: p.created_at,
  };
}

// ── API functions ───────────────────────────────────────────────────────

export async function getShopifyProducts(limit = 250): Promise<XenoProduct[]> {
  const data = await shopifyFetch<{ products: ShopifyProduct[] }>(
    `/products.json?limit=${limit}&status=active`
  );
  return data.products.map(normalizeProduct);
}

// Fetches ALL active products across multiple pages (max 10 pages = 2500 products).
export async function getAllShopifyProducts(): Promise<XenoProduct[]> {
  const all: XenoProduct[] = [];
  let url: string | null = `${BASE}/products.json?limit=250&status=active`;

  for (let page = 0; page < 10 && url; page++) {
    const res = await fetch(url, {
      headers: { "X-Shopify-Access-Token": TOKEN },
      cache:   "no-store",
    });
    if (!res.ok) break;

    const data = await res.json() as { products: ShopifyProduct[] };
    all.push(...data.products.map(normalizeProduct));

    // Shopify page_info cursor from Link header
    url = extractNextUrl(res.headers.get("link"));
  }

  return all;
}

export async function getShopifyProduct(id: string): Promise<XenoProduct | null> {
  try {
    const data = await shopifyFetch<{ product: ShopifyProduct }>(
      `/products/${id}.json`
    );
    return normalizeProduct(data.product);
  } catch {
    return null;
  }
}
