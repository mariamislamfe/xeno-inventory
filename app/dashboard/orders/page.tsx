"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Download, RefreshCw, Eye, Printer, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/OrderStatusBadge";
import { mockOrders } from "@/lib/mock/orders";
import type { Order } from "@/lib/types";

// ── Filter tab definition ──────────────────────────────────────────────
type TabKey = "all" | "delivered" | "returned" | "cancelled" | "printed" | "unprinted";

interface Tab {
  key: TabKey;
  label: string;
  filter: (o: Order) => boolean;
  color?: string;
}

const TABS: Tab[] = [
  { key: "all",       label: "الكل",         filter: () => true },
  { key: "delivered", label: "مكتملة",       filter: (o) => o.status === "delivered",                          color: "#22c55e" },
  { key: "returned",  label: "مرتجعة",       filter: (o) => o.status === "returned",                           color: "#f59e0b" },
  { key: "cancelled", label: "ملغية",        filter: (o) => o.status === "cancelled",                          color: "#ef4444" },
  { key: "printed",   label: "مطبوعة",       filter: (o) => o.printLabelReady === true,                        color: "#3b82f6" },
  { key: "unprinted", label: "غير مطبوعة",   filter: (o) => !o.printLabelReady && o.status !== "delivered" && o.status !== "cancelled", color: "#8b5cf6" },
];

// ── Helpers ──────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── WhatsApp status indicator ─────────────────────────────────────────
function WaStatus({ status }: { status?: string }) {
  if (!status || status === "not_sent") return null;
  return (
    <span
      title={
        status === "confirmed" ? "أكد العميل على الواتساب"
        : status === "seen"    ? "شاف الرسالة"
        : "تم الإرسال"
      }
      className="text-[11px] font-bold"
      style={{ color: status === "confirmed" ? "#22c55e" : status === "seen" ? "#60a5fa" : "#94a3b8" }}
    >
      {status === "confirmed" ? "✓✓" : status === "seen" ? "✓✓" : "✓"}
    </span>
  );
}

const PAGE_SIZE = 15;

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);

  // Count per tab (from full dataset — Future: Shopify webhook counts)
  const counts = useMemo(() =>
    Object.fromEntries(TABS.map((t) => [t.key, mockOrders.filter(t.filter).length])),
  []);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.key === activeTab)!;
    let data = mockOrders.filter(tab.filter);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          (o.autoTrackingNumber ?? "").toLowerCase().includes(q)
      );
    }
    return data;
  }, [activeTab, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function switchTab(key: TabKey) {
    setActiveTab(key);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">الطلبات</h1>
          <p className="text-small mt-0.5">إجمالي {mockOrders.length} طلب</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Download size={14} />} className="hidden sm:inline-flex">تصدير</Button>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} className="hidden sm:inline-flex">تحديث</Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                active
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-numbers min-w-[22px] text-center ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-[var(--border-color)] text-[var(--text-muted)]"
                }`}
                style={!active && tab.color ? { background: tab.color + "22", color: tab.color } : {}}
              >
                {counts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="card p-3">
        <SearchInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="بحث برقم الطلب أو اسم العميل أو رقم التتبع..."
        />
        {search && (
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {filtered.length} نتيجة
            <button onClick={() => setSearch("")} className="text-[var(--danger)] font-medium mr-2 hover:underline">مسح</button>
          </p>
        )}
      </div>

      {/* Table */}
      <div className="card">
        {paginated.length === 0 ? (
          <EmptyState title="لا توجد طلبات" description="لا توجد طلبات في هذه الفئة" />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رقم الطلب</th>
                    <th>العميل</th>
                    <th>المنتجات</th>
                    <th>الإجمالي</th>
                    <th>الحالة</th>
                    <th>الدفع</th>
                    <th>واتساب</th>
                    <th>رقم التتبع</th>
                    <th>التاريخ</th>
                    <th className="text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="font-mono text-[var(--primary)] font-bold text-xs hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td>
                        <div>
                          <p className="font-semibold text-[var(--text-primary)] text-xs">{order.customerName}</p>
                          <p className="text-[11px] text-[var(--text-muted)] font-mono">{order.customerPhone}</p>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-0.5">
                          {order.items.slice(0, 2).map((item) => (
                            <p key={item.id} className="text-[11px] text-[var(--text-muted)] truncate max-w-[130px]">
                              {item.productName}
                              {item.variant && <span className="opacity-60"> · {item.variant}</span>}
                            </p>
                          ))}
                          {order.items.length > 2 && (
                            <p className="text-[10px] text-[var(--primary)]">+{order.items.length - 2} أخرى</p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="font-bold text-[var(--text-primary)] text-xs font-numbers" dir="ltr">
                          {order.total.toLocaleString("en-US")} ج.م
                        </span>
                      </td>
                      <td>
                        <OrderStatusBadge status={order.status} size="sm" />
                      </td>
                      <td>
                        <PaymentStatusBadge status={order.paymentStatus} size="sm" />
                      </td>
                      <td className="text-center">
                        <WaStatus status={order.whatsappStatus} />
                      </td>
                      <td>
                        {order.autoTrackingNumber ? (
                          <span className="text-[11px] font-mono text-[var(--success)]" dir="ltr">
                            {order.autoTrackingNumber}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td>
                        <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                          {formatDate(order.createdAt)}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--primary)] transition-colors"
                            title="عرض"
                          >
                            <Eye size={14} />
                          </Link>
                          {order.printLabelReady ? (
                            <button
                              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--success)] hover:bg-[var(--success-light)] transition-colors"
                              title="طباعة البوليصة"
                              onClick={() => window.open(`/dashboard/orders/${order.id}/label`, "_blank")}
                            >
                              <Printer size={14} />
                            </button>
                          ) : (
                            order.status !== "delivered" && order.status !== "cancelled" && (
                              <Link
                                href={`/dashboard/orders/${order.id}`}
                                className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
                                title="إرسال للشحن"
                              >
                                <Truck size={14} />
                              </Link>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
