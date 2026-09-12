"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Package, Archive, AlertTriangle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import type { InventoryStatus } from "@/lib/types";

interface InventoryRow {
  id: string;
  shopifyId: number;
  productName: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  status: InventoryStatus;
  image?: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "جميع الحالات" },
  { value: "in_stock", label: "متوفر" },
  { value: "low_stock", label: "مخزون منخفض" },
  { value: "out_of_stock", label: "نفد المخزون" },
];

type BadgeVariant = "success" | "warning" | "danger";

const STATUS_CONFIG: Record<InventoryStatus, { label: string; variant: BadgeVariant }> = {
  in_stock:     { label: "متوفر",          variant: "success" },
  low_stock:    { label: "مخزون منخفض",    variant: "warning" },
  out_of_stock: { label: "نفد المخزون",    variant: "danger"  },
};

const PAGE_SIZE = 15;

export default function InventoryPage() {
  const [items,        setItems]        = useState<InventoryRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "">("");
  const [page,         setPage]         = useState(1);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/shopify/products?limit=250");
      const data = await res.json();
      const products = (data.products ?? []) as Array<{
        id: string; shopifyId: number; name: string; sku: string;
        category: string; stock: number; minStock: number; price: number;
        status: InventoryStatus; image?: string;
      }>;
      setItems(products.map((p) => ({
        id:          p.id,
        shopifyId:   p.shopifyId,
        productName: p.name,
        sku:         p.sku,
        category:    p.category,
        stock:       p.stock,
        minStock:    p.minStock,
        price:       p.price,
        status:      p.status,
        image:       p.image,
      })));
    } catch { /* keep empty */ }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const filtered = useMemo(() => {
    let data = [...items];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (i) => i.productName.toLowerCase().includes(q) ||
               i.sku.toLowerCase().includes(q) ||
               i.category.toLowerCase().includes(q)
      );
    }
    if (statusFilter) data = data.filter((i) => i.status === statusFilter);
    return data;
  }, [items, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalItems  = items.length;
  const inStock     = items.filter((i) => i.status === "in_stock").length;
  const lowStock    = items.filter((i) => i.status === "low_stock").length;
  const outOfStock  = items.filter((i) => i.status === "out_of_stock").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">المخزون</h1>
          <p className="text-small mt-0.5">متابعة مستويات المخزون عبر Shopify</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={fetchInventory}>
          تحديث
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="إجمالي المنتجات"   value={loading ? "—" : totalItems}  icon={<Package size={18} />}       color="var(--primary)" bg="var(--primary-light)" />
        <StatCard title="المنتجات المتاحة"  value={loading ? "—" : inStock}     icon={<Archive size={18} />}       color="var(--success)" bg="var(--success-light)" />
        <StatCard title="منخفضة المخزون"    value={loading ? "—" : lowStock}    icon={<AlertTriangle size={18} />} color="var(--warning)" bg="var(--warning-light)" />
        <StatCard title="نفد المخزون"        value={loading ? "—" : outOfStock}  icon={<XCircle size={18} />}      color="var(--danger)"  bg="var(--danger-light)"  />
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
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--text-muted)]">
            <Loader2 size={18} className="animate-spin" /> جارٍ التحميل من Shopify...
          </div>
        ) : paginated.length === 0 ? (
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
                    <th>المخزون</th>
                    <th>الحد الأدنى</th>
                    <th>الحالة</th>
                    <th>السعر</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => {
                    const config = STATUS_CONFIG[item.status];
                    const stockPct = item.minStock > 0
                      ? Math.min(100, Math.round((item.stock / (item.minStock * 5)) * 100))
                      : item.stock > 0 ? 100 : 0;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            {item.image ? (
                              <img src={item.image} alt={item.productName}
                                className="w-9 h-9 rounded-[var(--radius-md)] object-cover flex-shrink-0 bg-[var(--bg-base)]" />
                            ) : (
                              <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--bg-base)] flex items-center justify-center flex-shrink-0">
                                <Package size={15} className="text-[var(--text-muted)]" />
                              </div>
                            )}
                            <p className="text-xs font-medium text-[var(--text-primary)] line-clamp-2">{item.productName}</p>
                          </div>
                        </td>
                        <td><span className="font-mono text-xs text-[var(--text-muted)]">{item.sku}</span></td>
                        <td><span className="text-xs text-[var(--text-secondary)]">{item.category}</span></td>
                        <td>
                          <div className="space-y-1">
                            <span className={`text-sm font-bold ${
                              item.status === "out_of_stock" ? "text-[var(--danger)]"
                              : item.status === "low_stock"  ? "text-[var(--warning)]"
                              : "text-[var(--text-primary)]"
                            }`}>{item.stock}</span>
                            <div className="w-20">
                              <div className="progress-bar">
                                <div className="progress-bar-fill" style={{
                                  width: `${stockPct}%`,
                                  background: stockPct === 0 ? "var(--danger)" : stockPct < 30 ? "var(--warning)" : "var(--success)",
                                }} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td><span className="text-xs text-[var(--text-muted)]">{item.minStock}</span></td>
                        <td>
                          <Badge variant={config.variant} size="sm">{config.label}</Badge>
                        </td>
                        <td>
                          <span className="text-xs font-semibold text-[var(--text-primary)]">
                            {item.price.toLocaleString("ar-EG")} ج
                          </span>
                        </td>
                        <td>
                          <Link href={`/dashboard/products/${item.shopifyId}`}
                            className="text-xs text-[var(--primary)] hover:underline font-medium">
                            تفاصيل
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
                <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
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
        <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center" style={{ background: bg, color }}>{icon}</div>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
