import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Clock, MapPin, Phone, Truck } from "lucide-react";
import { getShipmentById } from "@/lib/services/shipments";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SHIPMENT_STATUS_LABELS } from "@/lib/mock/shipments";
import type { ShipmentStatus } from "@/lib/types";

interface ShipmentPageProps {
  params: Promise<{ id: string }>;
}

type BadgeVariant = "warning" | "primary" | "orange" | "success" | "danger" | "neutral";

const STATUS_CONFIG: Record<ShipmentStatus, { variant: BadgeVariant }> = {
  preparing: { variant: "warning" },
  shipped: { variant: "primary" },
  in_delivery: { variant: "orange" },
  delivered: { variant: "success" },
  failed: { variant: "danger" },
  returned: { variant: "neutral" },
};

export default async function ShipmentPage({ params }: ShipmentPageProps) {
  const { id } = await params;
  const shipment = await getShipmentById(id);

  if (!shipment) notFound();

  const cfg = STATUS_CONFIG[shipment.status];

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/dashboard/shipments" className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors">
          <ArrowRight size={16} />
          الشحنات
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{shipment.shipmentNumber}</span>
      </div>

      {/* Header */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-page-title">{shipment.shipmentNumber}</h1>
              <Badge variant={cfg.variant} dot>
                {SHIPMENT_STATUS_LABELS[shipment.status]}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">رقم التتبع</p>
                <span className="font-mono text-sm font-bold text-[var(--primary)]">
                  {shipment.trackingNumber}
                </span>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">شركة الشحن</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {shipment.shippingProvider}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">الطلب المرتبط</p>
                <Link
                  href={`/dashboard/orders/${shipment.orderId}`}
                  className="text-sm font-mono font-bold text-[var(--primary)] hover:underline"
                >
                  {shipment.orderNumber}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-section-title mb-5">مسار الشحنة</h2>
            <div className="relative">
              {shipment.timeline.map((event, idx) => (
                <div key={event.id} className="flex gap-4 relative">
                  {idx < shipment.timeline.length - 1 && (
                    <div
                      className="absolute top-5 right-[8px] w-0.5 h-full"
                      style={{
                        background: event.completed ? "var(--success)" : "var(--border-color)",
                      }}
                    />
                  )}
                  <div className="flex-shrink-0 relative z-10 mt-0.5">
                    {event.completed ? (
                      <CheckCircle2 size={18} className="text-[var(--success)]" />
                    ) : (
                      <Circle size={18} className="text-[var(--border-color)]" />
                    )}
                  </div>
                  <div className={`pb-5 flex-1 ${!event.completed ? "opacity-40" : ""}`}>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{event.label}</p>
                    {event.location && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MapPin size={12} className="text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--text-muted)]">{event.location}</span>
                      </div>
                    )}
                    {event.timestamp && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={12} className="text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(event.timestamp).toLocaleDateString("ar-EG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Info */}
        <div className="space-y-5">
          <Card>
            <h2 className="text-section-title mb-4">معلومات التسليم</h2>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-[var(--text-muted)] mb-0.5">العميل</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{shipment.customerName}</p>
              </div>
              <a href={`tel:${shipment.customerPhone}`} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                <Phone size={14} className="text-[var(--text-muted)]" />
                {shipment.customerPhone}
              </a>
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--text-secondary)]">
                  {shipment.address}، {shipment.city}، {shipment.governorate}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-section-title mb-4">تفاصيل الشحن</h2>
            <div className="space-y-2">
              <InfoRow label="تاريخ الشحن" value={new Date(shipment.createdAt).toLocaleDateString("ar-EG")} />
              <InfoRow label="التسليم المتوقع" value={new Date(shipment.estimatedDelivery).toLocaleDateString("ar-EG")} />
              {shipment.deliveredAt && (
                <InfoRow label="تاريخ التسليم" value={new Date(shipment.deliveredAt).toLocaleDateString("ar-EG")} />
              )}
              <InfoRow label="تكلفة الشحن" value={`${shipment.shippingCost.toLocaleString("ar-EG")} ج.م`} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
