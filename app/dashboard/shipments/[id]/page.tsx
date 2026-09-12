import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Clock, MapPin, Phone } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface ShipmentPageProps {
  params: Promise<{ id: string }>;
}

type DbShipmentStatus = "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "returned" | "failed";
type BadgeVariant = "warning" | "primary" | "orange" | "success" | "danger" | "neutral";

const STATUS_CONFIG: Record<DbShipmentStatus, { variant: BadgeVariant; label: string }> = {
  pending:          { variant: "warning",  label: "في الانتظار" },
  picked_up:        { variant: "primary",  label: "تم الاستلام" },
  in_transit:       { variant: "primary",  label: "في الطريق" },
  out_for_delivery: { variant: "orange",   label: "قيد التوصيل" },
  delivered:        { variant: "success",  label: "تم التوصيل" },
  returned:         { variant: "neutral",  label: "مرتجع" },
  failed:           { variant: "danger",   label: "فشل التوصيل" },
};

const STATUS_ORDER: DbShipmentStatus[] = [
  "pending", "picked_up", "in_transit", "out_for_delivery", "delivered"
];

function buildTimeline(currentStatus: DbShipmentStatus, shippedAt: string | null, deliveredAt: string | null) {
  const steps = [
    { status: "pending",          label: "جاري التجهيز" },
    { status: "picked_up",        label: "تم الاستلام من المخزن" },
    { status: "in_transit",       label: "في الطريق" },
    { status: "out_for_delivery", label: "قيد التوصيل" },
    { status: "delivered",        label: "تم التسليم" },
  ];

  const currentIdx = STATUS_ORDER.indexOf(currentStatus as DbShipmentStatus);
  const isTerminal = currentStatus === "returned" || currentStatus === "failed";

  return steps.map((step, idx) => {
    const completed = isTerminal ? idx === 0 : idx <= currentIdx;
    let timestamp: string | null = null;
    if (step.status === "picked_up" || step.status === "in_transit") timestamp = shippedAt;
    if (step.status === "delivered") timestamp = deliveredAt;
    return { ...step, completed, timestamp };
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ShipmentPage({ params }: ShipmentPageProps) {
  const { id } = await params;

  const { data: shipment, error } = await supabaseAdmin
    .from("shipments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !shipment) notFound();

  const cfg      = STATUS_CONFIG[shipment.status as DbShipmentStatus] ?? STATUS_CONFIG.pending;
  const timeline = buildTimeline(
    shipment.status as DbShipmentStatus,
    shipment.shipped_at,
    shipment.delivered_at
  );

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/dashboard/shipments" className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors">
          <ArrowRight size={16} />
          الشحنات
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{shipment.order_number}</span>
      </div>

      {/* Header */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-page-title">{shipment.order_number}</h1>
              <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
            </div>
            <div className="flex flex-wrap gap-4">
              {shipment.tracking_number && (
                <div>
                  <p className="text-[11px] text-[var(--text-muted)]">رقم التتبع</p>
                  <span className="font-mono text-sm font-bold text-[var(--primary)]">{shipment.tracking_number}</span>
                </div>
              )}
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">شركة الشحن</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{shipment.provider ?? "J&T Express"}</p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">الطلب المرتبط</p>
                <Link href={`/dashboard/orders/${shipment.shopify_order_id}`}
                  className="text-sm font-mono font-bold text-[var(--primary)] hover:underline">
                  {shipment.order_number}
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
              {timeline.map((event, idx) => (
                <div key={event.status} className="flex gap-4 relative">
                  {idx < timeline.length - 1 && (
                    <div className="absolute top-5 right-[8px] w-0.5 h-full"
                      style={{ background: event.completed ? "var(--success)" : "var(--border-color)" }} />
                  )}
                  <div className="flex-shrink-0 relative z-10 mt-0.5">
                    {event.completed
                      ? <CheckCircle2 size={18} className="text-[var(--success)]" />
                      : <Circle size={18} className="text-[var(--border-color)]" />
                    }
                  </div>
                  <div className={`pb-5 flex-1 ${!event.completed ? "opacity-40" : ""}`}>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{event.label}</p>
                    {event.timestamp && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={12} className="text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(event.timestamp).toLocaleDateString("ar-EG", {
                            year: "numeric", month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
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
                <p className="text-sm font-semibold text-[var(--text-primary)]">{shipment.customer_name ?? "—"}</p>
              </div>
              {shipment.phone && (
                <a href={`tel:${shipment.phone}`} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                  <Phone size={14} className="text-[var(--text-muted)]" />
                  {shipment.phone}
                </a>
              )}
              {shipment.address && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--text-secondary)]">
                    {[shipment.address, shipment.city, shipment.governorate].filter(Boolean).join("، ")}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-section-title mb-4">تفاصيل الشحن</h2>
            <div className="space-y-2">
              <InfoRow label="تاريخ الإنشاء"    value={formatDate(shipment.created_at)} />
              <InfoRow label="تاريخ الشحن"       value={formatDate(shipment.shipped_at)} />
              {shipment.delivered_at && (
                <InfoRow label="تاريخ التسليم"   value={formatDate(shipment.delivered_at)} />
              )}
              {shipment.cod_amount != null && shipment.cod_amount > 0 && (
                <InfoRow label="مبلغ COD" value={`${Number(shipment.cod_amount).toLocaleString("ar-EG")} ج`} />
              )}
              {shipment.notes && (
                <div className="pt-2 text-xs text-[var(--text-muted)]">{shipment.notes}</div>
              )}
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
