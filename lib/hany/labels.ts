// Arabic labels, badge colours and allowed changes for HANY orders, plus the mapping
// that lets a HANY order sit in the same orders list as the Shopify ones.
import type { HanyOrder, HanyOrderStatus, HanyPaymentStatus } from "./types";
import type { XenoOrder } from "@/lib/shopify/orders";
import { hanyId } from "./ids";

type Variant = "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "orange" | "primary";

// Same words and colours as a Shopify order (جديد / مكتمل / ملغي). بيتجهز / اتشحن / اتسلم
// are the J&T shipping steps: they show in the order history, the badge says مكتمل (hanyBadge).
export const HANY_STATUS: Record<HanyOrderStatus, { label: string; variant: Variant }> = {
  pending:    { label: "جديد",       variant: "warning" },
  confirmed:  { label: "مكتمل",      variant: "success" },
  processing: { label: "بيتجهز",     variant: "purple"  },
  shipped:    { label: "اتشحن",      variant: "orange"  },
  delivered:  { label: "اتسلم",      variant: "success" },
  cancelled:  { label: "ملغي",       variant: "danger"  },
};

export const HANY_PAYMENT: Record<HanyPaymentStatus, { label: string; variant: Variant }> = {
  pending:  { label: "غير مدفوع",  variant: "danger"  },
  paid:     { label: "مدفوع",      variant: "success" },
  failed:   { label: "فشل الدفع",  variant: "danger"  },
  refunded: { label: "مسترد",      variant: "neutral" },
};

/** The status badge of a HANY order: what a Shopify order in the same state shows. */
export function hanyBadge(s: HanyOrderStatus) {
  return HANY_STATUS[s === "processing" || s === "shipped" || s === "delivered" ? "confirmed" : s];
}

/** Status changes made by hand, the same ones as on Shopify (مكتمل / ملغي).
 *  The shipping steps after that come from J&T (lib/hany/fulfilment). */
export function hanyManualNext(s: HanyOrderStatus) {
  return NEXT_STATUS[s].filter((to) => to === "confirmed" || to === "cancelled");
}

// Same rules HANY enforces (anything else returns 409)
export const NEXT_STATUS: Record<HanyOrderStatus, HanyOrderStatus[]> = {
  pending:    ["confirmed", "cancelled"],
  confirmed:  ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped:    ["delivered"],
  delivered:  [],
  cancelled:  [],
};

export const NEXT_PAYMENT: Record<HanyPaymentStatus, HanyPaymentStatus[]> = {
  pending:  ["paid", "failed"],
  failed:   ["pending", "paid"],
  paid:     ["refunded"],
  refunded: [],
};

export const PAYMENT_METHOD: Record<string, string> = {
  cash_on_delivery: "الدفع عند الاستلام",
};

export type OrderSource = "shopify" | "hany";

export const SOURCE_DISPLAY: Record<OrderSource, { label: string; className: string }> = {
  shopify: { label: "Shopify", className: "bg-[#95bf47]/15 text-[#5e8e3e] border border-[#95bf47]/40" },
  hany:    { label: "HANY",    className: "bg-[#111]/10 text-[var(--text-primary)] border border-[var(--border-color)]" },
};

export function hanyOrderHref(orderNumber: string) {
  return `/dashboard/orders/hany/${encodeURIComponent(orderNumber)}`;
}

function shippingLine(o: HanyOrder) {
  const s = o.shipping;
  return [s.address, s.building, s.area && s.area !== "All areas" ? s.area : null].filter(Boolean).join("، ");
}

/** A HANY order in the shape of the orders list. `shopifyId` is its HANY number
 *  (lib/hany/ids), which the shipping / label / WhatsApp code recognises and routes to HANY. */
export function hanyToXeno(o: HanyOrder): XenoOrder {
  return {
    id:            `hany-${o.order_number}`,
    shopifyId:     hanyId(o.order_number),
    source:        "hany",
    hany:          { status: o.status, paymentStatus: o.payment_status },
    orderNumber:   o.order_number,
    customerName:  o.customer?.name ?? "",
    customerPhone: o.customer?.phone ?? "",
    email:         o.customer?.email ?? "",
    address:       shippingLine(o),
    city:          o.shipping?.city ?? "",
    governorate:   o.shipping?.city ?? "",
    status:        o.status === "cancelled" ? "cancelled" : o.status === "delivered" ? "delivered" : "pending",
    paymentStatus: o.payment_status === "paid" ? "paid" : o.payment_status === "refunded" ? "refunded" : "unpaid",
    total:         o.totals?.total ?? 0,
    items:         (o.items ?? []).map((it, i) => ({
      id:          `${it.variant_id}-${i}`,
      productName: it.name,
      variant:     [it.color, it.size].filter(Boolean).join(" / "),
      sku:         it.sku,
      quantity:    it.quantity,
      price:       it.unit_price,
    })),
    note:          o.notes ?? undefined,
    tags:          [],
    createdAt:     o.created_at,
  };
}
