"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

interface Transaction {
  id: string;
  type: "in" | "out";
  sku: string;
  productName: string;
  category: string;
  quantity: number;
  note: string | null;
  source: string;
  createdBy: string;
  createdAt: string;
}

type TypeFilter = "" | "in" | "out";

const PAGE_SIZE = 15;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("");
  const [page,         setPage]         = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { success } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (typeFilter)      params.set("type",   typeFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res  = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.transactions ?? []);
      setTotal(data.total ?? 0);
    } catch { /* fail silently */ }
    finally  { setLoading(false); }
  }, [page, typeFilter, debouncedSearch]);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);
  useEffect(() => { setPage(1); }, [typeFilter, debouncedSearch]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const tabs: { key: TypeFilter; label: string; color: string }[] = [
    { key: "",    label: "الكل",  color: "" },
    { key: "in",  label: "وارد", color: "#22c55e" },
    { key: "out", label: "صادر", color: "#ef4444" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">المعاملات</h1>
          <p className="text-small mt-0.5">سجل حركة المخزون — {total} معاملة</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={14} />}
          onClick={() => success("قريباً", "نموذج إضافة المعاملة قيد التطوير")}>
          إضافة معاملة
        </Button>
      </div>

      {/* Type filter tabs + search */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button key={tab.key}
            onClick={() => setTypeFilter(tab.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold transition-all ${
              typeFilter === tab.key
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}>
            {tab.label}
          </button>
        ))}

        <div className="relative flex-1 max-w-xs mr-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بـ SKU أو اسم المنتج..."
            className="form-input pl-9 text-xs"
          />
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--text-muted)]">
            <Loader2 size={18} className="animate-spin" /> جارٍ التحميل...
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState title="لا توجد معاملات" description="لا توجد معاملات تطابق هذا البحث" />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>النوع</th>
                    <th>المنتج</th>
                    <th>SKU</th>
                    <th>القسم</th>
                    <th>الكمية</th>
                    <th>السبب</th>
                    <th>المصدر</th>
                    <th>المستخدم</th>
                    <th>تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          txn.type === "in"
                            ? "bg-[var(--success-light)] text-[var(--success)]"
                            : "bg-[var(--danger-light)] text-[var(--danger)]"
                        }`}>
                          {txn.type === "in" ? <ArrowDown size={10} /> : <ArrowUp size={10} />}
                          {txn.type === "in" ? "وارد" : "صادر"}
                        </span>
                      </td>
                      <td><span className="text-xs text-[var(--text-primary)]">{txn.productName}</span></td>
                      <td><span className="text-xs font-mono text-[var(--text-muted)]" dir="ltr">{txn.sku}</span></td>
                      <td><span className="text-xs text-[var(--text-muted)]">{txn.category}</span></td>
                      <td>
                        <span className={`text-sm font-bold font-numbers ${
                          txn.type === "in" ? "text-[var(--success)]" : "text-[var(--danger)]"
                        }`} dir="ltr">
                          {txn.type === "in" ? "+" : "−"}{txn.quantity}
                        </span>
                      </td>
                      <td><span className="text-xs text-[var(--text-muted)]">{txn.note ?? "—"}</span></td>
                      <td>
                        <span className="text-[10px] text-[var(--text-muted)]">{txn.source}</span>
                      </td>
                      <td><span className="text-xs text-[var(--text-secondary)]">{txn.createdBy}</span></td>
                      <td>
                        <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                          {formatDate(txn.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-4 border-t border-[var(--border-subtle)]">
                <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
