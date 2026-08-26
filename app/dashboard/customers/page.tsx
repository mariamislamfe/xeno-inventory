"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { mockCustomers } from "@/lib/mock/customers";

const STATUS_OPTIONS = [
  { value: "", label: "جميع العملاء" },
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "">("");
  const [page, setPage] = useState(1);

  const totalActive = mockCustomers.filter((c) => c.status === "active").length;
  const totalSpent = mockCustomers.reduce((s, c) => s + c.totalSpent, 0);

  const filtered = useMemo(() => {
    let data = [...mockCustomers];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.city.includes(q)
      );
    }
    if (statusFilter) data = data.filter((c) => c.status === statusFilter);
    return data;
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">العملاء</h1>
          <p className="text-small mt-0.5">إدارة قاعدة بيانات العملاء</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={15} />}>
          إضافة عميل
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">إجمالي العملاء</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{mockCustomers.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">العملاء النشطون</p>
          <p className="text-2xl font-bold text-[var(--success)]">{totalActive}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">إجمالي المشتريات</p>
          <p className="text-2xl font-bold text-[var(--primary)]">
            {totalSpent.toLocaleString("ar-EG")} <span className="text-sm font-normal text-[var(--text-muted)]">ج.م</span>
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
        {paginated.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title="لا يوجد عملاء"
            description="لا يوجد عملاء يطابقون معايير البحث"
          />
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
                    <th>آخر طلب</th>
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
                            <p className="text-xs font-medium text-[var(--text-primary)]">
                              {customer.name}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)]">{customer.city}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-[var(--text-secondary)]">
                          {customer.phone}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-[var(--text-muted)] truncate max-w-[160px] block">
                          {customer.email}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {customer.governorate}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          {customer.orderCount}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-[var(--primary)]">
                          {customer.totalSpent.toLocaleString("ar-EG")} ج.م
                        </span>
                      </td>
                      <td>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {formatDate(customer.lastOrderDate)}
                        </span>
                      </td>
                      <td>
                        <Badge
                          variant={customer.status === "active" ? "success" : "neutral"}
                          size="sm"
                          dot
                        >
                          {customer.status === "active" ? "نشط" : "غير نشط"}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--primary)] transition-colors inline-flex"
                          aria-label={`عرض ${customer.name}`}
                        >
                          <Eye size={15} />
                        </Link>
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
