"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Plus, Package, Eye, Edit, Download, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { XenoProduct } from "@/lib/shopify/products";

const STOCK_OPTIONS = [
  { value: "",             label: "جميع الحالات" },
  { value: "in_stock",    label: "متوفر" },
  { value: "low_stock",   label: "منخفض" },
  { value: "out_of_stock", label: "نفد" },
];

const STOCK_CONFIG = {
  in_stock:    { label: "متوفر",   variant: "success"  as const },
  low_stock:   { label: "منخفض",  variant: "warning"  as const },
  out_of_stock: { label: "نفد",    variant: "danger"   as const },
};

const PAGE_SIZE = 12;

export default function ProductsPage() {
  const [products,     setProducts]     = useState<XenoProduct[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [search,       setSearch]       = useState("");
  const [stockFilter,  setStockFilter]  = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const { success, error } = useToast();

  async function loadProducts() {
    setLoading(true);
    try {
      const res  = await fetch("/api/shopify/products");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProducts(data.products);
    } catch (err) {
      error("خطأ", "تعذر تحميل المنتجات من Shopify");
    } finally {
      setLoading(false);
    }
  }

  async function syncFromShopify() {
    setSyncing(true);
    try {
      const res  = await fetch("/api/shopify/products", { cache: "no-store" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProducts(data.products);
      success("تمت المزامنة", `${data.count} منتج من Shopify`);
    } catch {
      error("خطأ", "فشل تحديث المنتجات");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  const categories = useMemo(
    () => ["", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))],
    [products]
  );

  const filtered = useMemo(() => {
    let data = [...products];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }
    if (stockFilter)    data = data.filter((p) => p.status === stockFilter);
    if (categoryFilter) data = data.filter((p) => p.category === categoryFilter);
    return data;
  }, [products, search, stockFilter, categoryFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">المنتجات</h1>
          <p className="text-small mt-0.5">
            {loading ? "جارٍ التحميل..." : `${products.length} منتج من Shopify`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary" size="sm"
            icon={syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            onClick={syncFromShopify}
            disabled={syncing}
          >
            {syncing ? "جارٍ المزامنة..." : "مزامنة Shopify"}
          </Button>
          <a
            href="https://xeno-eg.myshopify.com/admin/products/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="primary" size="sm" icon={<ExternalLink size={13} />}>
              إضافة منتج في Shopify
            </Button>
          </a>
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
            options={categories.map((c) => ({ value: c, label: c || "جميع التصنيفات" }))}
          />
          <Select
            value={stockFilter}
            onChange={(e) => { setStockFilter(e.target.value); setPage(1); }}
            options={STOCK_OPTIONS}
          />
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="card p-16 flex items-center justify-center gap-3">
          <Loader2 size={22} className="animate-spin text-[var(--primary)]" />
          <p className="text-sm text-[var(--text-muted)]">جارٍ تحميل المنتجات من Shopify...</p>
        </div>
      ) : paginated.length === 0 ? (
        <div className="card">
          <EmptyState title="لا توجد منتجات" description="لا توجد منتجات تطابق معايير البحث" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map((product) => {
              const sc = STOCK_CONFIG[product.status];
              return (
                <div key={product.id} className="card p-4 hover:shadow-[var(--shadow-md)] transition-shadow">
                  {/* Image */}
                  <div className="w-full aspect-square rounded-[var(--radius-lg)] bg-[var(--bg-base)] flex items-center justify-center mb-3 overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={36} className="text-[var(--border-color)]" />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--text-primary)] leading-tight flex-1">
                        {product.name}
                      </p>
                      <Badge variant={sc.variant} size="sm">{sc.label}</Badge>
                    </div>

                    <p className="text-[11px] font-mono text-[var(--text-muted)]">{product.sku}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{product.category}</p>

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {product.price.toLocaleString("en-US")} ج.م
                      </p>
                      <div className="text-left">
                        <p className="text-[11px] text-[var(--text-muted)]">المخزون</p>
                        <p className={`text-sm font-bold ${
                          product.stock === 0 ? "text-[var(--danger)]"
                          : product.stock <= 10 ? "text-[var(--warning)]"
                          : "text-[var(--text-primary)]"
                        }`} dir="ltr">
                          {product.stock}
                        </p>
                      </div>
                    </div>

                    {/* Variants count */}
                    {product.variants.length > 1 && (
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {product.variants.length} متغير
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <a
                      href={`https://xeno-eg.myshopify.com/admin/products/${product.shopifyId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-[var(--radius-sm)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
                    >
                      <Edit size={13} />
                      تعديل في Shopify
                    </a>
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-[var(--radius-sm)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
                    >
                      <Eye size={13} />
                      عرض
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="card p-4">
              <Pagination
                page={page} totalPages={totalPages}
                total={filtered.length} pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
