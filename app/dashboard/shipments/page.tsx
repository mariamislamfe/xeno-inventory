"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Truck, Package, CheckCircle, RotateCcw, Eye, Clock } from "lucide-react";
import { SearchInput, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { mockShipments, SHIPMENT_STATUS_LABELS } from "@/lib/mock/shipments";
import type { ShipmentStatus } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "", label: "جميع الحالات" },
  { value: "preparing", label: "جاري التجهيز" },
  { value: "shipped", label: "تم الشحن" },
  { value: "in_delivery", label: "قيد التوصيل" },
  { value: "delivered", label: "تم التوصيل" },
  { value: "failed", label: "فشل التوصيل" },
  { value: "returned", label: "مرتجع" },
];

type BadgeVariant = "warning" | "primary" | "orange" | "success" | "danger" | "neutral";

const STATUS_CONFIG: Record<ShipmentStatus, { variant: BadgeVariant }> = {
  preparing: { variant: "warning" },
  shipped: { variant: "primary" },
  in_delivery: { variant: "orange" },
  delivered: { variant: "success" },
  failed: { variant: "danger" },
  returned: { variant: "neutral" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const PAGE_SIZE = 10;

export default function ShipmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "">("");
  const [page, setPage] = useState(1);

  const totalDelivered = mockShipments.filter((s) => s.status === "delivered").length;
  const inDelivery = mockShipments.filter((s) => s.status === "in_delivery").length;
  const returned = mockShipments.filter((s) => s.status === "returned").length;

  const filtered = useMemo(() => {
    let data = [...mockShipments];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (s) =>
          s.shipmentNumber.toLowerCase().includes(q) ||
          s.trackingNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.orderNumber.includes(q)
      );
    }
    if (statusFilter) data = data.filter((s) => s.status === statusFilter);
    return data;
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">الشحنات</h1>
          <p className="text-small mt-0.5">متابعة وإدارة الشحنات</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="إجمالي الشحنات" value={mockShipments.length} icon={<Package size={18} />} color="var(--primary)" bg="var(--primary-light)" />
        <StatCard title="قيد التوصيل" value={inDelivery} icon={<Truck size={18} />} color="var(--warning)" bg="var(--warning-light)" />
        <StatCard title="تم التوصيل" value={totalDelivered} icon={<CheckCircle size={18} />} color="var(--success)" bg="var(--success-light)" />
        <StatCard title="مرتجع" value={returned} icon={<RotateCcw size={18} />} color="var(--neutral)" bg="var(--neutral-light)" />
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="بحث برقم الشحنة أو التتبع أو العميل..."
          />
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as ShipmentStatus | ""); setPage(1); }}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {paginated.length === 0 ? (
          <EmptyState icon={<Truck size={28} />} title="لا توجد شحنات" description="لا توجد شحنات تطابق معايير البحث" />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رقم الشحنة</th>
                    <th>رقم الطلب</th>
                    <th>العميل</th>
                    <th>شركة الشحن</th>
                    <th>رقم التتبع</th>
                    <th>الحالة</th>
                    <th>التاريخ</th>
                    <th>التسليم المتوقع</th>
                    <th className="text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((shipment) => {
                    const cfg = STATUS_CONFIG[shipment.status];
                    return (
                      <tr key={shipment.id}>
                        <td>
                          <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                            {shipment.shipmentNumber}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/dashboard/orders/${shipment.orderId}`}
                            className="font-mono text-xs text-[var(--primary)] hover:underline"
                          >
                            {shipment.orderNumber}
                          </Link>
                        </td>
                        <td>
                          <div>
                            <p className="text-xs font-medium text-[var(--text-primary)]">
                              {shipment.customerName}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              {shipment.city}، {shipment.governorate}
                            </p>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {shipment.shippingProvider}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-xs text-[var(--primary)] font-semibold">
                            {shipment.trackingNumber}
                          </span>
                        </td>
                        <td>
                          <Badge variant={cfg.variant} size="sm" dot>
                            {SHIPMENT_STATUS_LABELS[shipment.status]}
                          </Badge>
                        </td>
                        <td>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {formatDate(shipment.createdAt)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Clock size={11} className="text-[var(--text-muted)]" />
                            <span className="text-[11px] text-[var(--text-muted)]">
                              {formatDate(shipment.estimatedDelivery)}
                            </span>
                          </div>
                        </td>
                        <td className="text-center">
                          <Link
                            href={`/dashboard/shipments/${shipment.id}`}
                            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--primary)] transition-colors inline-flex"
                          >
                            <Eye size={15} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-4 border-t border-[var(--border-subtle)]">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  total={filtered.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, bg }: { title: string; value: number; icon: React.ReactNode; color: string; bg: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[var(--text-muted)]">{title}</p>
        <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center" style={{ background: bg, color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
