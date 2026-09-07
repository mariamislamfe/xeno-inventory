"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { RefreshCw, Eye, Printer, Truck, Loader2, Search, ChevronDown, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { XenoOrder } from "@/lib/shopify/orders";

// ── Status display ─────────────────────────────────────────────────────
const STATUS_DISPLAY: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  pending:    { label: "جديد",    variant: "warning" },
  processing: { label: "معالجة", variant: "info"    },
  delivered:  { label: "مكتمل",  variant: "success" },
  cancelled:  { label: "ملغي",   variant: "danger"  },
  returned:   { label: "مرتجع",  variant: "neutral" },
};

const PAYMENT_DISPLAY: Record<string, { label: string; variant: "success" | "danger" | "warning" | "neutral" }> = {
  paid:     { label: "مدفوع",     variant: "success" },
  unpaid:   { label: "غير مدفوع", variant: "danger"  },
  partial:  { label: "جزئي",      variant: "warning" },
  refunded: { label: "مسترد",    variant: "neutral" },
};

// ── Tag color map (Vrobo + common tags) ───────────────────────────────
const TAG_COLORS: Record<string, string> = {
  confirmed:      "bg-green-100 text-green-700",
  مؤكد:           "bg-green-100 text-green-700",
  cancelled:      "bg-red-100 text-red-700",
  ملغي:           "bg-red-100 text-red-700",
  shipped:        "bg-blue-100 text-blue-700",
  مشحون:          "bg-blue-100 text-blue-700",
  returned:       "bg-orange-100 text-orange-700",
  مرتجع:          "bg-orange-100 text-orange-700",
  "no answer":    "bg-gray-100 text-gray-600",
  لم_يرد:         "bg-gray-100 text-gray-600",
  pending:        "bg-yellow-100 text-yellow-700",
  paid:           "bg-emerald-100 text-emerald-700",
  unpaid:         "bg-rose-100 text-rose-700",
  "cash on delivery": "bg-purple-100 text-purple-700",
  cod:            "bg-purple-100 text-purple-700",
};

function tagStyle(tag: string) {
  const key = tag.toLowerCase();
  return TAG_COLORS[key] ?? "bg-[var(--bg-base)] text-[var(--text-muted)]";
}

// ── Vrobo quick-filter tags ────────────────────────────────────────────
const VROBO_TAGS = [
  { value: "",          label: "كل التاجز" },
  { value: "confirmed", label: "✅ مؤكد (Vrobo)" },
  { value: "cancelled", label: "❌ ملغي (Vrobo)" },
  { value: "shipped",   label: "📦 مشحون (Vrobo)" },
  { value: "returned",  label: "↩ مرتجع" },
  { value: "paid",      label: "💰 مدفوع" },
  { value: "unpaid",    label: "🚫 غير مدفوع" },
];

// ── Filter tabs ────────────────────────────────────────────────────────
type TabKey = "any" | "pending" | "fulfilled" | "unfulfilled";

const TABS: { key: TabKey; label: string; shopifyParam: Record<string, string> }[] = [
  { key: "any",         label: "الكل",       shopifyParam: { status: "any" } },
  { key: "unfulfilled", label: "جديدة",      shopifyParam: { status: "open",   fulfillment_status: "unfulfilled" } },
  { key: "pending",     label: "قيد التنفيذ", shopifyParam: { status: "open",   fulfillment_status: "partial" } },
  { key: "fulfilled",   label: "مكتملة",     shopifyParam: { status: "closed", fulfillment_status: "fulfilled" } },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const PAGE_SIZE = 50;

export default function OrdersPage() {
  const [orders,       setOrders]       = useState<XenoOrder[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(false);
  const [nextPageInfo, setNextPageInfo] = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<TabKey>("any");
  const [search,       setSearch]       = useState("");
  const [searchInput,  setSearchInput]  = useState("");
  const [tagFilter,    setTagFilter]    = useState("");
  const [totalCount,   setTotalCount]   = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const { error } = useToast();

  async function fetchCount(tab: TabKey) {
    try {
      const t  = TABS.find((t) => t.key === tab)!;
      const qs = new URLSearchParams(t.shopifyParam).toString();
      const res  = await fetch(`/api/shopify/orders/count?${qs}`);
      const data = await res.json();
      setTotalCount(data.count ?? null);
    } catch { setTotalCount(null); }
  }

  async function loadOrders(tab: TabKey, q: string, tag: string, cursor: string | null = null) {
    cursor ? setLoadingMore(true) : setLoading(true);
    try {
      const t      = TABS.find((t) => t.key === tab)!;
      const params = new URLSearchParams({ ...t.shopifyParam, limit: String(PAGE_SIZE) });
      if (cursor) {
        // cursor-based: only limit + page_info
        params.set("page_info", cursor);
      } else {
        if (q)   params.set("query", q);
        if (tag) params.set("tag", tag);
      }

      const res  = await fetch(`/api/shopify/orders?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setOrders((prev) => cursor ? [...prev, ...data.orders] : data.orders);
      setHasMore(data.has_more ?? false);
      setNextPageInfo(data.next_page_info ?? null);
    } catch {
      error("خطأ", "تعذر تحميل الطلبات من Shopify");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setOrders([]);
    setNextPageInfo(null);
    loadOrders(activeTab, search, tagFilter);
    fetchCount(activeTab);
  }, [activeTab, search, tagFilter]);

  function switchTab(key: TabKey) {
    setActiveTab(key);
    setOrders([]);
    setNextPageInfo(null);
  }

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 500);
  }

  function handleTagFilter(val: string) {
    setTagFilter(val);
    setOrders([]);
    setNextPageInfo(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">الطلبات</h1>
          <p className="text-small mt-0.5">
            {loading ? "جارٍ التحميل..."
              : totalCount != null ? `${totalCount.toLocaleString("en-US")} طلب على Shopify`
              : `${orders.length} طلب`}
          </p>
        </div>
        <Button
          variant="secondary" size="sm"
          icon={loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={14} />}
          onClick={() => { setOrders([]); setNextPageInfo(null); loadOrders(activeTab, search, tagFilter); fetchCount(activeTab); }}
          disabled={loading}
        >
          تحديث
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                active ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search + Tag Filter */}
      <div className="card p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="بحث برقم الطلب أو اسم العميل..."
              className="form-input pl-9"
            />
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          </div>
          {/* Vrobo Tag Filter */}
          <div className="relative">
            <select
              value={tagFilter}
              onChange={(e) => handleTagFilter(e.target.value)}
              className="form-input appearance-none pr-4 pl-8 cursor-pointer"
            >
              {VROBO_TAGS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <Tag size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>
        </div>
        {tagFilter && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)]">فلتر نشط:</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tagStyle(tagFilter)}`}>{tagFilter}</span>
            <button onClick={() => handleTagFilter("")} className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-16">
            <Loader2 size={22} className="animate-spin text-[var(--primary)]" />
            <p className="text-sm text-[var(--text-muted)]">جارٍ تحميل الطلبات من Shopify...</p>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState title="لا توجد طلبات" description="لا توجد طلبات في هذه الفئة" />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رقم الطلب</th>
                    <th>العميل</th>
                    <th>المنتجات</th>
                    <th>الإجمالي</th>
                    <th>الحالة</th>
                    <th>الدفع</th>
                    <th>تاجز Shopify</th>
                    <th>رقم التتبع</th>
                    <th>التاريخ</th>
                    <th className="text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const st = STATUS_DISPLAY[order.status] ?? { label: order.status, variant: "neutral" as const };
                    const pm = PAYMENT_DISPLAY[order.paymentStatus] ?? { label: order.paymentStatus, variant: "neutral" as const };
                    return (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-[var(--primary)] font-bold text-xs hover:underline">
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td>
                          <div>
                            <p className="font-semibold text-[var(--text-primary)] text-xs">{order.customerName}</p>
                            <p className="text-[11px] text-[var(--text-muted)] font-mono" dir="ltr">{order.customerPhone}</p>
                          </div>
                        </td>
                        <td>
                          <div className="space-y-0.5">
                            {order.items.slice(0, 2).map((item) => (
                              <p key={item.id} className="text-[11px] text-[var(--text-muted)] truncate max-w-[130px]">
                                {item.productName}
                                {item.variant && <span className="opacity-60"> · {item.variant}</span>}
                              </p>
                            ))}
                            {order.items.length > 2 && (
                              <p className="text-[10px] text-[var(--primary)]">+{order.items.length - 2} أخرى</p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="font-bold text-[var(--text-primary)] text-xs font-numbers" dir="ltr">
                            {order.total.toLocaleString("en-US")} ج.م
                          </span>
                        </td>
                        <td><Badge variant={st.variant} size="sm">{st.label}</Badge></td>
                        <td><Badge variant={pm.variant} size="sm">{pm.label}</Badge></td>

                        {/* Shopify Tags (from Vrobo + other apps) */}
                        <td>
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {order.tags.length === 0 ? (
                              <span className="text-[11px] text-[var(--text-muted)]">—</span>
                            ) : (
                              order.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity ${tagStyle(tag)}`}
                                  title={`فلتر: ${tag}`}
                                  onClick={() => handleTagFilter(tag)}
                                >
                                  {tag}
                                </span>
                              ))
                            )}
                            {order.tags.length > 4 && (
                              <span className="text-[10px] text-[var(--text-muted)]">+{order.tags.length - 4}</span>
                            )}
                          </div>
                        </td>

                        <td>
                          {order.trackingNumber ? (
                            <span className="text-[11px] font-mono text-[var(--success)]" dir="ltr">{order.trackingNumber}</span>
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td>
                          <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">{formatDate(order.createdAt)}</span>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <Link href={`/dashboard/orders/${order.id}`}
                              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--primary)] transition-colors"
                              title="عرض">
                              <Eye size={14} />
                            </Link>
                            {order.trackingNumber ? (
                              <button className="p-1.5 rounded-[var(--radius-sm)] text-[var(--success)] hover:bg-[var(--success-light)] transition-colors"
                                title="طباعة البوليصة"
                                onClick={() => window.open(`/dashboard/orders/${order.id}/label`, "_blank")}>
                                <Printer size={14} />
                              </button>
                            ) : (
                              order.status !== "delivered" && order.status !== "cancelled" && (
                                <Link href={`/dashboard/orders/${order.id}`}
                                  className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
                                  title="إرسال للشحن">
                                  <Truck size={14} />
                                </Link>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Load more — now with correct cursor */}
            {hasMore && (
              <div className="flex justify-center p-4 border-t border-[var(--border-subtle)]">
                <Button
                  variant="secondary" size="sm"
                  icon={loadingMore ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
                  onClick={() => loadOrders(activeTab, search, tagFilter, nextPageInfo)}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? "جارٍ التحميل..."
                    : `تحميل المزيد (${orders.length.toLocaleString("en-US")} / ${totalCount?.toLocaleString("en-US") ?? "..."})`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
