"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Eye, Users, RefreshCw, Loader2, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { XenoCustomer } from "@/lib/shopify/customers";

const STATUS_OPTIONS = [
  { value: "",         label: "جميع العملاء" },
  { value: "active",   label: "نشط" },
  { value: "inactive", label: "غير نشط" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
  });
}

const PAGE_SIZE = 50;

export default function CustomersPage() {
  const [customers,    setCustomers]    = useState<XenoCustomer[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(false);
  const [nextPageInfo, setNextPageInfo] = useState<string | null>(null);
  const [totalCount,   setTotalCount]   = useState<number | null>(null);
  const [search,       setSearch]       = useState("");
  const [searchInput,  setSearchInput]  = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "">("");
  const { success, error } = useToast();
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  async function loadCustomers(q: string, cursor: string | null = null) {
    cursor ? setLoadingMore(true) : setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("page_info", cursor);
      else if (q) params.set("query", q);

      const res  = await fetch(`/api/shopify/customers?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setCustomers((prev) => cursor ? [...prev, ...data.customers] : data.customers);
      setHasMore(data.has_more);
      setNextPageInfo(data.next_page_info ?? null);
      if (!cursor) setTotalCount(null);
    } catch {
      error("خطأ", "تعذر تحميل العملاء من Shopify");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function fetchTotal() {
    try {
      const res  = await fetch("/api/shopify/customers/count");
      const data = await res.json();
      setTotalCount(data.count ?? null);
    } catch {}
  }

  useEffect(() => {
    setCustomers([]);
    setNextPageInfo(null);
    loadCustomers(search);
    fetchTotal();
  }, [search]);

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 500);
  }

  // client-side status filter (doesn't need new API call)
  const filtered = useMemo(() => {
    if (!statusFilter) return customers;
    return customers.filter((c) => c.status === statusFilter);
  }, [customers, statusFilter]);

  const totalActive = customers.filter((c) => c.status === "active").length;
  const totalSpent  = customers.reduce((s, c) => s + c.totalSpent, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">العملاء</h1>
          <p className="text-small mt-0.5">
            {loading ? "جارٍ التحميل..."
              : totalCount != null ? `${totalCount.toLocaleString("en-US")} عميل على Shopify`
              : `${customers.length} عميل محمّل`}
          </p>
        </div>
        <Button
          variant="secondary" size="sm"
          icon={loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          onClick={() => { setCustomers([]); setNextPageInfo(null); loadCustomers(search); fetchTotal(); }}
          disabled={loading}
        >
          تحديث
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">إجمالي العملاء</p>
          <p className="text-stat-md" dir="ltr">{totalCount?.toLocaleString("en-US") ?? "..."}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">محملون الآن</p>
          <p className="text-stat-md text-[var(--success)]" dir="ltr">{customers.length.toLocaleString("en-US")}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">إجمالي المشتريات (محملة)</p>
          <p className="text-stat-md text-[var(--primary)]" dir="ltr">
            {totalSpent.toLocaleString("en-US")} <span className="text-sm font-normal text-[var(--text-muted)]">ج.م</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف أو البريد..."
              className="form-input pl-9"
            />
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "active" | "inactive" | "")}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-16">
            <Loader2 size={22} className="animate-spin text-[var(--primary)]" />
            <p className="text-sm text-[var(--text-muted)]">جارٍ تحميل العملاء من Shopify...</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users size={28} />} title="لا يوجد عملاء" description="لا يوجد عملاء يطابقون معايير البحث" />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>العميل</th>
                    <th>الهاتف</th>
                    <th>البريد الإلكتروني</th>
                    <th>المحافظة</th>
                    <th>عدد الطلبات</th>
                    <th>إجمالي المشتريات</th>
                    <th>تاريخ التسجيل</th>
                    <th>الحالة</th>
                    <th className="text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {customer.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-[var(--text-primary)]">{customer.name}</p>
                            <p className="text-[11px] text-[var(--text-muted)]">{customer.city}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-[var(--text-secondary)]" dir="ltr">{customer.phone || "—"}</span>
                      </td>
                      <td>
                        <span className="text-xs text-[var(--text-muted)] truncate max-w-[160px] block" dir="ltr">{customer.email}</span>
                      </td>
                      <td>
                        <span className="text-xs text-[var(--text-secondary)]">{customer.governorate || "—"}</span>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-[var(--text-primary)]" dir="ltr">{customer.ordersCount}</span>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-[var(--primary)]" dir="ltr">
                          {customer.totalSpent.toLocaleString("en-US")} ج.م
                        </span>
                      </td>
                      <td>
                        <span className="text-[11px] text-[var(--text-muted)]">{formatDate(customer.createdAt)}</span>
                      </td>
                      <td>
                        <Badge variant={customer.status === "active" ? "success" : "neutral"} size="sm" dot>
                          {customer.status === "active" ? "نشط" : "غير نشط"}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <a
                          href={`https://xeno-eg.myshopify.com/admin/customers/${customer.shopifyId}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--primary)] transition-colors inline-flex"
                          title="عرض في Shopify"
                        >
                          <Eye size={15} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center p-4 border-t border-[var(--border-subtle)]">
                <Button
                  variant="secondary" size="sm"
                  icon={loadingMore ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
                  onClick={() => loadCustomers(search, nextPageInfo)}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? "جارٍ التحميل..."
                    : `تحميل المزيد (${customers.length.toLocaleString("en-US")} / ${totalCount?.toLocaleString("en-US") ?? "..."})`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
