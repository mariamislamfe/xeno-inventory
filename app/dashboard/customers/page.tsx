"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Eye, Users, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
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

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const [customers,    setCustomers]    = useState<XenoCustomer[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "">("");
  const [page,         setPage]         = useState(1);
  const { success, error } = useToast();

  async function loadCustomers() {
    setLoading(true);
    try {
      const res  = await fetch("/api/shopify/customers");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCustomers(data.customers);
    } catch {
      error("خطأ", "تعذر تحميل العملاء من Shopify");
    } finally {
      setLoading(false);
    }
  }

  async function syncCustomers() {
    setSyncing(true);
    try {
      const res  = await fetch("/api/shopify/customers", { cache: "no-store" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCustomers(data.customers);
      success("تمت المزامنة", `${data.count} عميل من Shopify`);
    } catch {
      error("خطأ", "فشل تحديث العملاء");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { loadCustomers(); }, []);

  const totalActive = customers.filter((c) => c.status === "active").length;
  const totalSpent  = customers.reduce((s, c) => s + c.totalSpent, 0);

  const filtered = useMemo(() => {
    let data = [...customers];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q)
      );
    }
    if (statusFilter) data = data.filter((c) => c.status === statusFilter);
    return data;
  }, [customers, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">العملاء</h1>
          <p className="text-small mt-0.5">{loading ? "جارٍ التحميل..." : `${customers.length} عميل من Shopify`}</p>
        </div>
        <Button
          variant="secondary" size="sm"
          icon={syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          onClick={syncCustomers} disabled={syncing}
        >
          {syncing ? "جارٍ المزامنة..." : "مزامنة"}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">إجمالي العملاء</p>
          <p className="text-stat-md" dir="ltr">{customers.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">العملاء النشطون</p>
          <p className="text-stat-md text-[var(--success)]" dir="ltr">{totalActive}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">إجمالي المشتريات</p>
          <p className="text-stat-md text-[var(--primary)]" dir="ltr">
            {totalSpent.toLocaleString("en-US")} <span className="text-sm font-normal text-[var(--text-muted)]">ج.م</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="بحث بالاسم أو الهاتف أو البريد..."
          />
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as "active" | "inactive" | ""); setPage(1); }}
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
        ) : paginated.length === 0 ? (
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
                  {paginated.map((customer) => (
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
                          target="_blank"
                          rel="noopener noreferrer"
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
