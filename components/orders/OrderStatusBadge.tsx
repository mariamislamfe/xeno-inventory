import React from "react";
import { Badge } from "@/components/ui/Badge";
import type { PaymentStatus, ShippingStatus } from "@/lib/types";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "orange" | "primary";

// Covers both old OrderStatus values and XenoOrder.status values
const ORDER_STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  // XenoOrder.status values
  pending:    { label: "جديد",              variant: "info"    },
  processing: { label: "قيد التجهيز",       variant: "orange"  },
  delivered:  { label: "تم التوصيل",        variant: "success" },
  cancelled:  { label: "ملغي",              variant: "danger"  },
  returned:   { label: "مرتجع",             variant: "neutral" },
  // Legacy OrderStatus values (kept for backward compat)
  new:              { label: "جديد",              variant: "info"    },
  reviewing:        { label: "قيد المراجعة",      variant: "warning" },
  confirmed:        { label: "تم التأكيد",        variant: "primary" },
  processed:        { label: "تم التجهيز",        variant: "purple"  },
  sent_to_shipping: { label: "تم الإرسال للشحن", variant: "primary" },
  in_delivery:      { label: "قيد التوصيل",       variant: "warning" },
};

const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending: { label: "في الانتظار", variant: "warning" },
  paid: { label: "مدفوع", variant: "success" },
  refunded: { label: "مسترجع", variant: "neutral" },
  failed: { label: "فشل", variant: "danger" },
};

const SHIPPING_STATUS_CONFIG: Record<
  ShippingStatus,
  { label: string; variant: BadgeVariant }
> = {
  not_shipped: { label: "لم يُشحن", variant: "neutral" },
  preparing: { label: "جاري التجهيز", variant: "warning" },
  shipped: { label: "تم الشحن", variant: "primary" },
  in_delivery: { label: "قيد التوصيل", variant: "orange" },
  delivered: { label: "تم التوصيل", variant: "success" },
  failed: { label: "فشل التوصيل", variant: "danger" },
  returned: { label: "مرتجع", variant: "neutral" },
};

interface OrderStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  dot?: boolean;
}

export function OrderStatusBadge({ status, size, dot }: OrderStatusBadgeProps) {
  const config = ORDER_STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <Badge variant={config.variant} size={size} dot={dot}>
      {config.label}
    </Badge>
  );
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  size?: "sm" | "md";
}

export function PaymentStatusBadge({ status, size }: PaymentStatusBadgeProps) {
  const config = PAYMENT_STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
}

interface ShippingStatusBadgeProps {
  status: ShippingStatus;
  size?: "sm" | "md";
}

export function ShippingStatusBadge({ status, size }: ShippingStatusBadgeProps) {
  const config = SHIPPING_STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
}
