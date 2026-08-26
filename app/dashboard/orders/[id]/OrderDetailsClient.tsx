"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  Truck,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Package,
  MessageSquare,
  Printer,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  ShippingStatusBadge,
} from "@/components/orders/OrderStatusBadge";
import { useToast } from "@/components/ui/Toast";
import { sendToShipping } from "@/lib/services/orders";
import { sendWhatsAppMessage, buildShippingConfirmationMessage } from "@/lib/services/whatsapp";
import type { Order, OrderStatus } from "@/lib/types";
import { Card } from "@/components/ui/Card";

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimelineIcon({ completed, status }: { completed: boolean; status: OrderStatus }) {
  if (!completed) return <Circle size={18} className="text-[var(--border-color)]" />;
  if (status === "cancelled") return <XCircle size={18} className="text-[var(--danger)]" />;
  if (status === "returned") return <XCircle size={18} className="text-[var(--neutral)]" />;
  return <CheckCircle2 size={18} className="text-[var(--success)]" />;
}

interface ShipmentModalProps {
  open: boolean;
  onClose: () => void;
  order: Order;
  onSuccess: (trackingNumber: string) => void;
}

function ShipmentModal({ open, onClose, order, onSuccess }: ShipmentModalProps) {
  const [step, setStep] = useState<"confirm" | "loading" | "success">("confirm");
  const [trackingNumber, setTrackingNumber] = useState("");
  const { success, info } = useToast();

  async function handleConfirm() {
    setStep("loading");
    const result = await sendToShipping(order.id);
    setTrackingNumber(result.trackingNumber);
    setStep("success");

    success("تم الإرسال للشحن", `رقم التتبع: ${result.trackingNumber}`);

    // Simulate WhatsApp notification
    await sendWhatsAppMessage({
      phone: order.customerPhone,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      trackingNumber: result.trackingNumber,
      message: buildShippingConfirmationMessage(
        order.customerName,
        order.orderNumber,
        result.trackingNumber
      ),
    });

    info("تم إرسال رسالة WhatsApp", "تم تجهيز رسالة تأكيد الطلب للعميل");
    onSuccess(result.trackingNumber);
  }

  function handleClose() {
    setStep("confirm");
    setTrackingNumber("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={step === "loading" ? () => {} : handleClose}
      title={
        step === "success"
          ? "تم الإرسال للشحن بنجاح"
          : "إرسال الطلب لشركة الشحن"
      }
      size="md"
      footer={
        step === "confirm" ? (
          <>
            <Button variant="secondary" onClick={handleClose}>
              إلغاء
            </Button>
            <Button variant="primary" onClick={handleConfirm} icon={<Truck size={16} />}>
              تأكيد الإرسال
            </Button>
          </>
        ) : step === "success" ? (
          <Button variant="primary" onClick={handleClose}>
            إغلاق
          </Button>
        ) : undefined
      }
    >
      {step === "confirm" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            هل أنت متأكد من إرسال هذا الطلب لشركة الشحن؟
          </p>
          <div className="bg-[var(--bg-base)] rounded-[var(--radius-lg)] p-4 space-y-2.5">
            <InfoRow label="رقم الطلب" value={order.orderNumber} highlight />
            <InfoRow label="العميل" value={order.customerName} />
            <InfoRow label="الهاتف" value={order.customerPhone} />
            <InfoRow label="المحافظة" value={`${order.city}، ${order.governorate}`} />
            <InfoRow
              label="إجمالي الطلب"
              value={`${order.total.toLocaleString("ar-EG")} ج.م`}
              highlight
            />
          </div>
          <div className="text-xs text-[var(--text-muted)] bg-[var(--warning-light)] border border-[var(--warning-border)] rounded-[var(--radius-md)] p-3">
            سيتم إرسال الطلب لشركة الشحن وإرسال رسالة تأكيد للعميل على واتساب
          </div>
        </div>
      )}

      {step === "loading" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-12 h-12 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            جاري إرسال الطلب...
          </p>
        </div>
      )}

      {step === "success" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-14 h-14 rounded-full bg-[var(--success-light)] flex items-center justify-center">
              <CheckCircle2 size={32} className="text-[var(--success)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                تم إرسال الطلب بنجاح
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                رقم التتبع:{" "}
                <span className="font-mono font-bold text-[var(--primary)]">
                  {trackingNumber}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[var(--success-light)] border border-[var(--success-border)] rounded-[var(--radius-md)] p-3">
            <MessageSquare size={16} className="text-[var(--success)]" />
            <p className="text-xs text-[var(--success-text)]">
              تم تجهيز رسالة WhatsApp وإرسالها للعميل
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-muted)] text-xs">{label}</span>
      <span
        className={`text-xs font-medium ${
          highlight ? "text-[var(--primary)]" : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

interface OrderDetailsClientProps {
  order: Order;
}

export function OrderDetailsClient({ order: initialOrder }: OrderDetailsClientProps) {
  const [order, setOrder] = useState(initialOrder);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const { success } = useToast();

  const canShip =
    order.status === "processing" ||
    order.status === "processed" ||
    order.status === "confirmed";

  function handleShippingSuccess(trackingNumber: string) {
    setOrder((prev) => ({
      ...prev,
      status: "sent_to_shipping",
      shippingStatus: "shipped",
      trackingNumber,
      shippingProvider: "أراماكس",
    }));
  }

  return (
    <div className="space-y-5">
      {/* Back Navigation */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors"
        >
          <ArrowRight size={16} />
          الطلبات
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{order.orderNumber}</span>
      </div>

      {/* Order Header */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-page-title">{order.orderNumber}</h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-small">تاريخ الإنشاء: {formatDate(order.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canShip && (
              <Button
                variant="primary"
                size="sm"
                icon={<Truck size={15} />}
                onClick={() => setShipModalOpen(true)}
              >
                إرسال للشحن
              </Button>
            )}
            <Button variant="secondary" size="sm" icon={<Edit size={15} />}>
              تعديل
            </Button>
            <Button variant="secondary" size="sm" icon={<Printer size={15} />}>
              طباعة
            </Button>
          </div>
        </div>

        {/* Status Row */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <div>
            <p className="text-[11px] text-[var(--text-muted)] mb-1">حالة الطلب</p>
            <OrderStatusBadge status={order.status} />
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-muted)] mb-1">حالة الدفع</p>
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-muted)] mb-1">حالة الشحن</p>
            <ShippingStatusBadge status={order.shippingStatus} />
          </div>
          {order.trackingNumber && (
            <div>
              <p className="text-[11px] text-[var(--text-muted)] mb-1">رقم التتبع</p>
              <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-1 rounded-full">
                {order.trackingNumber}
              </span>
            </div>
          )}
          {order.shippingProvider && (
            <div>
              <p className="text-[11px] text-[var(--text-muted)] mb-1">شركة الشحن</p>
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {order.shippingProvider}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Items + Summary */}
        <div className="lg:col-span-2 space-y-5">
          {/* Order Items */}
          <Card>
            <h2 className="text-section-title mb-4">منتجات الطلب</h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>SKU</th>
                    <th>السعر</th>
                    <th>الكمية</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--bg-base)] flex items-center justify-center flex-shrink-0">
                            <Package size={16} className="text-[var(--text-muted)]" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-[var(--text-primary)]">
                              {item.productName}
                            </p>
                            {item.variant && (
                              <p className="text-[11px] text-[var(--text-muted)]">
                                {item.variant}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-[var(--text-muted)]">
                          {item.sku}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs">{item.price.toLocaleString("ar-EG")} ج.م</span>
                      </td>
                      <td>
                        <span className="text-xs font-medium">{item.quantity}</span>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          {item.total.toLocaleString("ar-EG")} ج.م
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Order Summary */}
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-2">
                  <SummaryRow
                    label="المجموع الفرعي"
                    value={`${order.subtotal.toLocaleString("ar-EG")} ج.م`}
                  />
                  <SummaryRow
                    label="الشحن"
                    value={`${order.shippingCost.toLocaleString("ar-EG")} ج.م`}
                  />
                  {order.discount > 0 && (
                    <SummaryRow
                      label="الخصم"
                      value={`-${order.discount.toLocaleString("ar-EG")} ج.م`}
                      className="text-[var(--success-text)]"
                    />
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-[var(--border-color)]">
                    <span className="text-sm font-bold text-[var(--text-primary)]">الإجمالي</span>
                    <span className="text-base font-bold text-[var(--primary)]">
                      {order.total.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Order Timeline */}
          <Card>
            <h2 className="text-section-title mb-5">مسار الطلب</h2>
            <div className="relative">
              {order.timeline.map((event, idx) => (
                <div key={event.id} className="flex gap-4 relative">
                  {/* Line */}
                  {idx < order.timeline.length - 1 && (
                    <div
                      className="absolute top-5 right-[8px] w-0.5 h-full -translate-x-1/2"
                      style={{
                        background: event.completed
                          ? "var(--success)"
                          : "var(--border-color)",
                      }}
                    />
                  )}
                  {/* Icon */}
                  <div className="flex-shrink-0 relative z-10 mt-0.5">
                    <TimelineIcon completed={event.completed} status={event.status} />
                  </div>
                  {/* Content */}
                  <div className={`pb-5 flex-1 ${!event.completed ? "opacity-40" : ""}`}>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {event.label}
                    </p>
                    {event.timestamp && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(event.timestamp)}
                      </p>
                    )}
                    {event.note && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 bg-[var(--bg-base)] px-2 py-1 rounded-[var(--radius-sm)]">
                        {event.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Customer Info */}
        <div className="space-y-5">
          {/* Customer */}
          <Card>
            <h2 className="text-section-title mb-4">معلومات العميل</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {order.customerName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {order.customerName}
                  </p>
                  <Link
                    href={`/dashboard/customers/${order.customerId}`}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    عرض الملف الشخصي
                  </Link>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                <a
                  href={`tel:${order.customerPhone}`}
                  className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
                >
                  <Phone size={14} className="text-[var(--text-muted)]" />
                  {order.customerPhone}
                </a>
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
                >
                  <Mail size={14} className="text-[var(--text-muted)]" />
                  {order.customerEmail}
                </a>
                <div className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
                  <MapPin size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                  <span>
                    {order.address}، {order.city}، {order.governorate}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <h2 className="text-section-title mb-3">ملاحظات</h2>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {order.notes}
              </p>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <h2 className="text-section-title mb-4">إجراءات سريعة</h2>
            <div className="space-y-2">
              {canShip && (
                <Button
                  variant="primary"
                  className="w-full"
                  size="sm"
                  icon={<Truck size={15} />}
                  onClick={() => setShipModalOpen(true)}
                >
                  إرسال للشحن
                </Button>
              )}
              <Button
                variant="secondary"
                className="w-full"
                size="sm"
                icon={<MessageSquare size={15} />}
              >
                تواصل مع العميل
              </Button>
              {order.status !== "cancelled" && order.status !== "delivered" && (
                <Button variant="ghost" className="w-full text-[var(--danger)]" size="sm">
                  إلغاء الطلب
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Shipment Modal */}
      <ShipmentModal
        open={shipModalOpen}
        onClose={() => setShipModalOpen(false)}
        order={order}
        onSuccess={handleShippingSuccess}
      />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-between items-center text-sm ${className}`}>
      <span className="text-[var(--text-muted)] text-xs">{label}</span>
      <span className="text-xs font-medium text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}
