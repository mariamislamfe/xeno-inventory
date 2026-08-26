"use client";

import React, { useState, useMemo } from "react";
import { Plus, Search, Filter, ArrowDown, ArrowUp } from "lucide-react";
import { mockTransactions } from "@/lib/mock/transactions";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

// Future: data comes from Supabase inventory_transactions table
// Each transaction is created via:
//   - Shopify Webhook (out: order fulfilled)
//   - Manual (in: stock receipt, out: damage/write-off)
//   - QuickTransaction widget

type TypeFilter = "" | "in" | "out";

const PAGE_SIZE = 15;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function TransactionsPage() {
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [page,       setPage]       = useState(1);
  const { success } = useToast();

  const filtered = useMemo(() => {
    let data = [...mockTransactions];
    if (typeFilter) data = data.filter((t) => t.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (t) =>
          t.sku.toLowerCase().includes(q) ||
          t.productName.includes(q) ||
          (t.note ?? "").includes(q)
      );
    }
    return data;
  }, [search, typeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Counts
  const inCount  = mockTransactions.filter((t) => t.type === "in").length;
  const outCount = mockTransactions.filter((t) => t.type === "out").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">المعاملات</h1>
          <p className="text-small mt-0.5">
            سجل حركة المخزون — {mockTransactions.length} معاملة
          </p>
        </div>
        <Button
          variant="primary" size="sm" icon={<Plus size={14} />}
          onClick={() => success("قريباً", "نموذج إضافة المعاملة قيد التطوير")}
        >
          إضافة معاملة
        </Button>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-2">
        {([
          { key: "",    label: "الكل",    count: mockTransactions.length, color: "" },
          { key: "in",  label: "وارد",    count: inCount,                 color: "#22c55e" },
          { key: "out", label: "صادر",    count: outCount,                color: "#ef4444" },
        ] as { key: TypeFilter; label: string; count: number; color: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setTypeFilter(tab.key); setPage(1); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold transition-all ${
              typeFilter === tab.key
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.label}
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold font-numbers min-w-[20px] text-center"
              style={typeFilter !== tab.key && tab.color
                ? { background: tab.color + "22", color: tab.color }
                : { background: "rgba(255,255,255,0.2)" }
              }
            >
              {tab.count}
            </span>
          </button>
        ))}

        {/* Search */}
        <div className="relative flex-1 max-w-xs mr-auto">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="بحث بـ SKU أو اسم المنتج..."
            className="form-input pl-9 text-xs"
          />
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {paginated.length === 0 ? (
          <EmptyState title="لا توجد معاملات" description="لا توجد معاملات تطابق هذا البحث" />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>المعرف</th>
                    <th>النوع</th>
                    <th>المنتج</th>
                    <th>SKU</th>
                    <th>القسم</th>
                    <th>الكمية</th>
                    <th>السبب</th>
                    <th>المستخدم</th>
                    <th>تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((txn) => (
                    <tr key={txn.id}>
                      <td>
                        <span className="text-xs font-mono text-[var(--text-muted)]">
                          {txn.id.replace("txn-", "")}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            txn.type === "in"
                              ? "bg-[var(--success-light)] text-[var(--success)]"
                              : "bg-[var(--danger-light)] text-[var(--danger)]"
                          }`}
                        >
                          {txn.type === "in"
                            ? <ArrowDown size={10} />
                            : <ArrowUp size={10} />
                          }
                          {txn.type === "in" ? "وارد" : "صادر"}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-[var(--text-primary)]">{txn.productName}</span>
                      </td>
                      <td>
                        <span className="text-xs font-mono text-[var(--text-muted)]" dir="ltr">{txn.sku}</span>
                      </td>
                      <td>
                        <span className="text-xs text-[var(--text-muted)]">{txn.category}</span>
                      </td>
                      <td>
                        <span
                          className={`text-sm font-bold font-numbers ${
                            txn.type === "in" ? "text-[var(--success)]" : "text-[var(--danger)]"
                          }`}
                          dir="ltr"
                        >
                          {txn.type === "in" ? "+" : "−"}{txn.quantity}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-[var(--text-muted)]">{txn.note ?? "—"}</span>
                      </td>
                      <td>
                        <span className="text-xs text-[var(--text-secondary)]">{txn.createdBy}</span>
                      </td>
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
                <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
