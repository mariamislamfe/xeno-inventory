"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Package, Eye, Edit, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { mockProducts, PRODUCT_CATEGORIES } from "@/lib/mock/products";
import type { ProductStatus } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "", label: "جميع الحالات" },
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
  { value: "draft", label: "مسودة" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "جميع التصنيفات" },
  ...PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c })),
];

type BadgeVariant = "success" | "neutral" | "warning";

const STATUS_CONFIG: Record<ProductStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "نشط", variant: "success" },
  inactive: { label: "غير نشط", variant: "neutral" },
  draft: { label: "مسودة", variant: "warning" },
};

const PAGE_SIZE = 12;

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let data = [...mockProducts];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    if (statusFilter) data = data.filter((p) => p.status === statusFilter);
    if (categoryFilter) data = data.filter((p) => p.category === categoryFilter);
    return data;
  }, [search, statusFilter, categoryFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">المنتجات</h1>
          <p className="text-small mt-0.5">إدارة كتالوج المنتجات</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Future: triggers Shopify Products API sync */}
          <Button
            variant="secondary" size="sm"
            icon={<RefreshCw size={13} />}
            title="استيراد المنتجات من Shopify — يتم الربط في المرحلة الثانية"
            onClick={() => alert("سيتم الربط مع Shopify في المرحلة الثانية")}
          >
            استيراد منتجات Shopify
          </Button>
          {/* Future: triggers EasyOrders CSV/API import */}
          <Button
            variant="secondary" size="sm"
            icon={<Download size={13} />}
            onClick={() => alert("سيتم الربط مع إيزي أوردر في المرحلة الثانية")}
          >
            استيراد منتجات إيزي أوردر
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={15} />}>
            إضافة منتج
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="بحث بالاسم أو SKU..."
          />
          <Select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            options={CATEGORY_OPTIONS}
          />
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as ProductStatus | ""); setPage(1); }}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {/* Products Grid */}
      {paginated.length === 0 ? (
        <div className="card">
          <EmptyState title="لا توجد منتجات" description="لا توجد منتجات تطابق معايير البحث" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map((product) => {
              const statusCfg = STATUS_CONFIG[product.status];
              return (
                <div key={product.id} className="card p-4 hover:shadow-[var(--shadow-md)] transition-shadow">
                  {/* Product Image */}
                  <div className="w-full aspect-square rounded-[var(--radius-lg)] bg-[var(--bg-base)] flex items-center justify-center mb-3 overflow-hidden">
                    <Package size={36} className="text-[var(--border-color)]" />
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--text-primary)] leading-tight flex-1">
                        {product.name}
                      </p>
                      <Badge variant={statusCfg.variant} size="sm">
                        {statusCfg.label}
                      </Badge>
                    </div>

                    <p className="text-[11px] font-mono text-[var(--text-muted)]">{product.sku}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{product.category}</p>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                          {product.price.toLocaleString("ar-EG")} ج.م
                        </p>
                        {product.comparePrice && (
                          <p className="text-[11px] text-[var(--text-muted)] line-through">
                            {product.comparePrice.toLocaleString("ar-EG")} ج.م
                          </p>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] text-[var(--text-muted)]">المخزون</p>
                        <p
                          className={`text-sm font-bold ${
                            product.inventory === 0
                              ? "text-[var(--danger)]"
                              : product.inventory < 10
                              ? "text-[var(--warning)]"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {product.inventory}
                        </p>
                      </div>
                    </div>

                    <div className="text-[11px] text-[var(--text-muted)]">
                      المبيعات: {product.totalSales} وحدة
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-[var(--radius-sm)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
                    >
                      <Eye size={13} />
                      عرض
                    </Link>
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-[var(--radius-sm)] hover:bg-[var(--bg-base)] transition-colors">
                      <Edit size={13} />
                      تعديل
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="card p-4">
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
  );
}
