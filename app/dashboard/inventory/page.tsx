"use client";

import React, { useState, useMemo } from "react";
import { Package, Archive, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { mockInventory } from "@/lib/mock/inventory";
import type { InventoryStatus } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "", label: "جميع الحالات" },
  { value: "in_stock", label: "متوفر" },
  { value: "low_stock", label: "مخزون منخفض" },
  { value: "out_of_stock", label: "نفد المخزون" },
];

type BadgeVariant = "success" | "warning" | "danger";

const STATUS_CONFIG: Record<InventoryStatus, { label: string; variant: BadgeVariant }> = {
  in_stock: { label: "متوفر", variant: "success" },
  low_stock: { label: "مخزون منخفض", variant: "warning" },
  out_of_stock: { label: "نفد المخزون", variant: "danger" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const PAGE_SIZE = 10;

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "">("");
  const [page, setPage] = useState(1);

  const totalItems = mockInventory.length;
  const inStock = mockInventory.filter((i) => i.status === "in_stock").length;
  const lowStock = mockInventory.filter((i) => i.status === "low_stock").length;
  const outOfStock = mockInventory.filter((i) => i.status === "out_of_stock").length;

  const filtered = useMemo(() => {
    let data = [...mockInventory];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (i) =>
          i.productName.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }
    if (statusFilter) data = data.filter((i) => i.status === statusFilter);
    return data;
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">المخزون</h1>
          <p className="text-small mt-0.5">متابعة وإدارة مستويات المخزون</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={15} />}>
          تحديث المخزون
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي المنتجات"
          value={totalItems}
          icon={<Package size={18} />}
          color="var(--primary)"
          bg="var(--primary-light)"
        />
        <StatCard
          title="المنتجات المتاحة"
          value={inStock}
          icon={<Archive size={18} />}
          color="var(--success)"
          bg="var(--success-light)"
        />
        <StatCard
          title="منخفضة المخزون"
          value={lowStock}
          icon={<AlertTriangle size={18} />}
          color="var(--warning)"
          bg="var(--warning-light)"
        />
        <StatCard
          title="نفد المخزون"
          value={outOfStock}
          icon={<XCircle size={18} />}
          color="var(--danger)"
          bg="var(--danger-light)"
        />
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="بحث بالاسم أو SKU أو التصنيف..."
          />
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as InventoryStatus | ""); setPage(1); }}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {paginated.length === 0 ? (
          <EmptyState title="لا توجد منتجات" description="لا توجد منتجات تطابق معايير البحث" />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>SKU</th>
                    <th>التصنيف</th>
                    <th>المخزون الحالي</th>
                    <th>نسبة الإشغال</th>
                    <th>الحالة</th>
                    <th>الموقع</th>
                    <th>آخر تحديث</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => {
                    const pct = Math.round((item.currentStock / item.maxStock) * 100);
                    const config = STATUS_CONFIG[item.status];
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--bg-base)] flex items-center justify-center flex-shrink-0">
                              <Package size={15} className="text-[var(--text-muted)]" />
                            </div>
                            <p className="text-xs font-medium text-[var(--text-primary)]">
                              {item.productName}
                            </p>
                          </div>
                        </td>
                        <td>
                          <span className="font-mono text-xs text-[var(--text-muted)]">
                            {item.sku}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {item.category}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`text-sm font-bold ${
                              item.status === "out_of_stock"
                                ? "text-[var(--danger)]"
                                : item.status === "low_stock"
                                ? "text-[var(--warning)]"
                                : "text-[var(--text-primary)]"
                            }`}
                          >
                            {item.currentStock}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            /{item.maxStock}
                          </span>
                        </td>
                        <td>
                          <div className="w-24">
                            <div className="progress-bar mb-1">
                              <div
                                className="progress-bar-fill"
                                style={{
                                  width: `${pct}%`,
                                  background:
                                    pct === 0
                                      ? "var(--danger)"
                                      : pct < 20
                                      ? "var(--warning)"
                                      : "var(--success)",
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-[var(--text-muted)]">{pct}%</p>
                          </div>
                        </td>
                        <td>
                          <Badge variant={config.variant} size="sm">
                            {config.label}
                          </Badge>
                        </td>
                        <td>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {item.location ?? "—"}
                          </span>
                        </td>
                        <td>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {formatDate(item.lastUpdated)}
                          </span>
                        </td>
                        <td>
                          <button className="text-xs text-[var(--primary)] hover:underline font-medium">
                            تعديل
                          </button>
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

function StatCard({
  title,
  value,
  icon,
  color,
  bg,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[var(--text-muted)]">{title}</p>
        <div
          className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center"
          style={{ background: bg, color }}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
