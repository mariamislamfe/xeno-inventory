// Shapes returned by the HANY store API (see HANY-API.md). Safe to import anywhere.

export type HanyOrderStatus   = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
export type HanyPaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface HanyPagination { page: number; limit: number; total: number; pages: number }

export interface HanyOrderItem {
  product_id: string;
  variant_id: string;
  name:       string;
  sku:        string;
  color:      string | null;
  size:       string | null;
  quantity:   number;
  unit_price: number;
  line_total: number;
  image:      string | null;
}

export interface HanyOrder {
  id:                string;
  order_number:      string;   // "HNY-100001"
  status:            HanyOrderStatus;
  payment_status:    HanyPaymentStatus;
  payment_method:    string;
  payment_reference: string | null;
  currency:          string;
  customer: { id: string; name: string; phone: string; email: string | null };
  shipping: { address: string | null; building: string | null; area: string | null; city: string | null };
  notes:             string | null;
  internal_notes:    string | null;
  totals: { subtotal: number; discount: number; discount_code: string | null; shipping: number; total: number };
  items:             HanyOrderItem[];
  history:           { from: string | null; to: string; note: string | null; at: string }[];
  created_at:        string;
  updated_at:        string;
}

export interface HanyVariant {
  id:             string;
  sku:            string;
  color:          string | null;
  color_hex:      string | null;
  size:           string | null;
  price:          number;
  price_override: number | null;
  stock:          number;
  is_available:   boolean;
}

export interface HanyProduct {
  id:               string;
  slug:             string;
  name:             string;
  description:      string | null;
  category:         { id: string; name: string; slug: string } | null;
  base_price:       number;
  compare_at_price: number | null;
  is_published:     boolean;
  is_featured:      boolean;
  archived:         boolean;
  url:              string;
  images:           { url: string; color: string | null }[];
  variants:         HanyVariant[];
}
