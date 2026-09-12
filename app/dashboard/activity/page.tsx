"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";

type ActivityEvent = {
  id: string;
  type: "order" | "inventory" | "shipment" | "system" | "user" | "whatsapp";
  action: string;
  detail: string | null;
  user_name: string | null;
  entity_id: string | null;
  created_at: string;
};

const TYPE_COLORS: Record<string, string> = {
  order:     "#3b82f6",
  inventory: "#f59e0b",
  shipment:  "#8b5cf6",
  system:    "#6b7280",
  user:      "#22c55e",
  whatsapp:  "#25d366",
};

const TYPE_LABELS: Record<string, string> = {
  order:     "طلب",
  inventory: "مخزون",
  shipment:  "شحنة",
  system:    "نظام",
  user:      "مستخدم",
  whatsapp:  "واتساب",
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
  const [events,     setEvents]     = useState<ActivityEvent[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page,       setPage]       = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (typeFilter)      params.set("type",   typeFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res  = await fetch(`/api/activity?${params}`);
      const data = await res.json();
      setEvents(data.events ?? []);
      setTotal(data.total  ?? 0);
    } catch { /* fail silently */ }
    finally  { setLoading(false); }
  }, [page, typeFilter, debouncedSearch]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [typeFilter, debouncedSearch]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث..."
            className="form-input pl-8 text-xs"
          />
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="form-input w-auto text-xs"
        >
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <span className="text-xs text-[var(--text-muted)]">{total} حدث</span>
      </div>

      {/* Timeline */}
      <div className="card divide-y divide-[var(--border-subtle)] min-h-[200px]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--text-muted)]">
            <Loader2 size={18} className="animate-spin" /> جارٍ التحميل...
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--text-muted)]">لا توجد أحداث</div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="flex items-start gap-3 p-4 hover:bg-[var(--bg-base)] transition-colors">
              <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                style={{ background: TYPE_COLORS[event.type] ?? "#6b7280" }} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: (TYPE_COLORS[event.type] ?? "#6b7280") + "22",
                      color: TYPE_COLORS[event.type] ?? "#6b7280",
                    }}>
                    {TYPE_LABELS[event.type] ?? event.type}
                  </span>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{event.action}</p>
                </div>
                {event.detail && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{event.detail}</p>
                )}
              </div>

              <div className="text-left flex-shrink-0 text-[11px] text-[var(--text-muted)] space-y-0.5">
                <p className="font-medium">{event.user_name ?? "النظام"}</p>
                <p>{timeAgo(event.created_at)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}
    </div>
  );
}
