"use client";

import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { mockNotifications } from "@/lib/mock/notifications";
import { mockTransactions } from "@/lib/mock/transactions";
import { Pagination } from "@/components/ui/Pagination";

// Future: SELECT * FROM activity_log ORDER BY created_at DESC
// Events: order.created, order.status_changed, inventory.transaction,
//         user.login, shipment.updated, whatsapp.sent

type ActivityEvent = {
  id: string;
  type: "order" | "inventory" | "shipment" | "system" | "user";
  action: string;
  detail: string;
  user: string;
  createdAt: string;
};

// Build mock activity log from existing mock data
const mockActivity: ActivityEvent[] = [
  ...mockTransactions.map((t, i) => ({
    id:        `act-txn-${i}`,
    type:      "inventory" as const,
    action:    t.type === "in" ? "إضافة مخزون" : "سحب مخزون",
    detail:    `${t.productName} [${t.sku}] — ${t.type === "in" ? "+" : "−"}${t.quantity} وحدة${t.note ? " · " + t.note : ""}`,
    user:      t.createdBy,
    createdAt: t.createdAt,
  })),
  ...mockNotifications.map((n, i) => ({
    id:        `act-notif-${i}`,
    type:      n.type as ActivityEvent["type"],
    action:    n.title,
    detail:    n.message,
    user:      "النظام",
    createdAt: n.createdAt,
  })),
].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const TYPE_COLORS: Record<string, string> = {
  order:     "#3b82f6",
  inventory: "#f59e0b",
  shipment:  "#8b5cf6",
  system:    "#6b7280",
  user:      "#22c55e",
};

const TYPE_LABELS: Record<string, string> = {
  order:     "طلب",
  inventory: "مخزون",
  shipment:  "شحنة",
  system:    "نظام",
  user:      "مستخدم",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return "منذ أقل من ساعة";
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${d} يوم`;
}

const PAGE_SIZE = 20;

export default function ActivityPage() {
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page,       setPage]       = useState(1);

  const filtered = useMemo(() => {
    let data = mockActivity;
    if (typeFilter) data = data.filter((a) => a.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (a) => a.action.includes(q) || a.detail.includes(q) || a.user.includes(q)
      );
    }
    return data;
  }, [search, typeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-page-title">سجل النشاط</h1>
        <p className="text-small mt-0.5">جميع العمليات التي تمت على النظام</p>
      </div>

      {/* Filters */}
      <div className="card p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="بحث..."
            className="form-input pl-8 text-xs"
          />
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="form-input w-auto text-xs"
        >
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <span className="text-xs text-[var(--text-muted)]">{filtered.length} حدث</span>
      </div>

      {/* Timeline */}
      <div className="card divide-y divide-[var(--border-subtle)]">
        {paginated.map((event) => (
          <div key={event.id} className="flex items-start gap-3 p-4 hover:bg-[var(--bg-base)] transition-colors">
            {/* Type dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
              style={{ background: TYPE_COLORS[event.type] ?? "#6b7280" }}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: (TYPE_COLORS[event.type] ?? "#6b7280") + "22",
                    color: TYPE_COLORS[event.type] ?? "#6b7280",
                  }}
                >
                  {TYPE_LABELS[event.type]}
                </span>
                <p className="text-xs font-semibold text-[var(--text-primary)]">{event.action}</p>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                {event.detail}
              </p>
            </div>

            {/* Meta */}
            <div className="text-left flex-shrink-0 text-[11px] text-[var(--text-muted)] space-y-0.5">
              <p className="font-medium">{event.user}</p>
              <p>{timeAgo(event.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}
    </div>
  );
}
