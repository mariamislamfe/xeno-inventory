"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Truck, Package, CheckCircle, RotateCcw, Eye, Clock, Loader2, AlertCircle } from "lucide-react";
import { SearchInput, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

// ── Supabase shipments status values ──────────────────────────────────────────
type DbShipmentStatus = "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "returned" | "failed";

interface DbShipment {
  id: string;
  shopify_order_id: number;
  order_number: string;
  tracking_number: string | null;
  provider: string | null;
  status: DbShipmentStatus;
  customer_name: string | null;
  phone: string | null;
  city: string | null;
  governorate: string | null;
  cod_amount: number | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
}

const STATUS_OPTIONS = [
  { value: "",                label: "جميع الحالات" },
  { value: "pending",         label: "في الانتظار" },
  { value: "picked_up",       label: "تم الاستلام" },
  { value: "in_transit",      label: "في الطريق" },
  { value: "out_for_delivery",label: "قيد التوصيل" },
  { value: "delivered",       label: "تم التوصيل" },
  { value: "returned",        label: "مرتجع" },
  { value: "failed",          label: "فشل التوصيل" },
];

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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

const PAGE_SIZE = 10;

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<DbShipment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<DbShipmentStatus | "">("");
  const [page, setPage] = useState(1);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/shipments");
      const data = await res.json();
      if (data.setup_needed) {
        setError("جدول الشحنات غير موجود. شغّل supabase/schema.sql أولاً.");
        setShipments([]);
      } else if (data.error) {
        setError(data.error);
        setShipments([]);
      } else {
        setShipments(data.shipments ?? []);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const filtered = useMemo(() => {
    let data = [...shipments];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (s) =>
          s.order_number.toLowerCase().includes(q) ||
          (s.tracking_number ?? "").toLowerCase().includes(q) ||
          (s.customer_name ?? "").toLowerCase().includes(q) ||
          (s.phone ?? "").includes(q)
      );
    }
    if (statusFilter) data = data.filter((s) => s.status === statusFilter);
    return data;
  }, [shipments, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalDelivered    = shipments.filter((s) => s.status === "delivered").length;
  const inDelivery        = shipments.filter((s) => s.status === "out_for_delivery" || s.status === "in_transit").length;
  const returned          = shipments.filter((s) => s.status === "returned").length;

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
        <StatCard title="إجمالي الشحنات"  value={loading ? "—" : shipments.length} icon={<Package size={18} />}     color="var(--primary)" bg="var(--primary-light)" />
        <StatCard title="قيد التوصيل"     value={loading ? "—" : inDelivery}       icon={<Truck size={18} />}       color="var(--warning)" bg="var(--warning-light)" />
        <StatCard title="تم التوصيل"      value={loading ? "—" : totalDelivered}   icon={<CheckCircle size={18} />} color="var(--success)" bg="var(--success-light)" />
        <StatCard title="مرتجع"           value={loading ? "—" : returned}         icon={<RotateCcw size={18} />}   color="var(--neutral)" bg="var(--neutral-light)" />
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-[var(--danger-light)] border border-[var(--danger)] rounded-[var(--radius-md)] text-sm text-[var(--danger)]">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="بحث برقم الطلب أو التتبع أو العميل..."
          />
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as DbShipmentStatus | ""); setPage(1); }}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--text-muted)]">
            <Loader2 size={18} className="animate-spin" /> جارٍ التحميل...
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState icon={<Truck size={28} />} title="لا توجد شحنات" description="لا توجد شحنات تطابق معايير البحث" />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رقم الطلب</th>
                    <th>العميل</th>
                    <th>شركة الشحن</th>
                    <th>رقم التتبع</th>
                    <th>الحالة</th>
                    <th>المبلغ (COD)</th>
                    <th>تاريخ الإنشاء</th>
                    <th>تاريخ الشحن</th>
                    <th className="text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s) => {
                    const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending;
                    return (
                      <tr key={s.id}>
                        <td>
                          <Link
                            href={`/dashboard/orders/${s.shopify_order_id}`}
                            className="font-mono text-xs text-[var(--primary)] hover:underline"
                          >
                            {s.order_number}
                          </Link>
                        </td>
                        <td>
                          <div>
                            <p className="text-xs font-medium text-[var(--text-primary)]">{s.customer_name ?? "—"}</p>
                            {(s.city || s.governorate) && (
                              <p className="text-[11px] text-[var(--text-muted)]">
                                {[s.city, s.governorate].filter(Boolean).join("، ")}
                              </p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-[var(--text-secondary)]">{s.provider ?? "J&T Express"}</span>
                        </td>
                        <td>
                          {s.tracking_number
                            ? <span className="font-mono text-xs text-[var(--primary)] font-semibold">{s.tracking_number}</span>
                            : <span className="text-xs text-[var(--text-muted)]">—</span>
                          }
                        </td>
                        <td>
                          <Badge variant={cfg.variant} size="sm" dot>{cfg.label}</Badge>
                        </td>
                        <td>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {s.cod_amount ? `${s.cod_amount.toLocaleString("ar-EG")} ج` : "—"}
                          </span>
                        </td>
                        <td>
                          <span className="text-[11px] text-[var(--text-muted)]">{formatDate(s.created_at)}</span>
                        </td>
                        <td>
                          {s.shipped_at ? (
                            <div className="flex items-center gap-1.5">
                              <Clock size={11} className="text-[var(--text-muted)]" />
                              <span className="text-[11px] text-[var(--text-muted)]">{formatDate(s.shipped_at)}</span>
                            </div>
                          ) : <span className="text-[11px] text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="text-center">
                          <Link
                            href={`/dashboard/shipments/${s.id}`}
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

function StatCard({ title, value, icon, color, bg }: {
  title: string; value: number | string; icon: React.ReactNode; color: string; bg: string
}) {
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
