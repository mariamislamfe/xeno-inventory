"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { RefreshCw, Eye, Printer, Truck, Loader2, Search, ChevronDown, Tag, X, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import type { XenoOrder } from "@/lib/shopify/orders";

// ── Product Picker ─────────────────────────────────────────────────────
interface ShopifyVariantSummary { id: number; title: string; sku: string; price: number }
interface ShopifyProductSummary { id: number; name: string; image?: string | null; variants: ShopifyVariantSummary[] }

function ProductPicker({ onSelect }: { onSelect: (title: string, variantTitle: string, sku: string, price: number, variantId: number) => void }) {
  const [q,        setQ]        = useState("");
  const [results,  setResults]  = useState<ShopifyProductSummary[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  function search(val: string) {
    setQ(val);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/shopify/products?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setResults((data.products ?? []).map((p: { id: number; name: string; image?: string | null; variants: ShopifyVariantSummary[] }) => p));
      } catch { setResults([]); }
      finally  { setLoading(false); }
    }, 350);
  }

  function pick(p: ShopifyProductSummary, v: ShopifyVariantSummary) {
    onSelect(p.name, v.title, v.sku, v.price, v.id);
    setQ(""); setResults([]); setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => search(e.target.value)}
        onFocus={() => q && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="form-input text-xs"
        placeholder="ابحث عن منتج من Shopify..."
      />
      {open && (q.trim() || loading) && (
        <div className="absolute z-50 top-full right-0 left-0 mt-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[var(--radius-md)] shadow-xl max-h-64 overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 p-3 text-xs text-[var(--text-muted)]">
              <Loader2 size={12} className="animate-spin" />
              جارٍ البحث...
            </div>
          )}
          {!loading && results.length === 0 && (
            <p className="p-3 text-xs text-[var(--text-muted)]">لم يُعثر على منتجات</p>
          )}
          {results.map((p) => (
            <div key={p.id}>
              <div className="px-3 py-1.5 text-[11px] font-bold text-[var(--text-muted)] bg-[var(--bg-base)] border-b border-[var(--border-subtle)]">
                {p.name}
              </div>
              {p.variants.map((v) => (
                <button
                  key={v.id}
                  onMouseDown={() => pick(p, v)}
                  className="w-full text-right px-3 py-2 hover:bg-[var(--bg-base)] flex items-center justify-between gap-3 transition-colors"
                >
                  <span className="text-xs text-[var(--text-primary)]">
                    {v.title ? `${p.name} — ${v.title}` : p.name}
                    {v.sku && <span className="text-[var(--text-muted)] mr-1">· {v.sku}</span>}
                  </span>
                  <span className="text-xs font-bold text-[var(--primary)] flex-shrink-0" dir="ltr">
                    {v.price.toLocaleString("en-US")} ج.م
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Egyptian Governorates ───────────────────────────────────────────────
const EG_GOVS = [
  "القاهرة","الإسكندرية","الجيزة","الشرقية","الدقهلية","البحيرة","المنوفية",
  "الغربية","كفر الشيخ","الإسماعيلية","بورسعيد","السويس","شمال سيناء",
  "جنوب سيناء","الفيوم","بني سويف","المنيا","أسيوط","سوهاج","قنا","الأقصر",
  "أسوان","البحر الأحمر","الوادي الجديد","مطروح","دمياط","القليوبية",
];

function GovPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const filtered = value.trim()
    ? EG_GOVS.filter((g) => g.includes(value.trim()))
    : EG_GOVS;
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="form-input"
        placeholder="اكتب لتصفية المحافظات..."
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full right-0 left-0 mt-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[var(--radius-md)] shadow-xl max-h-48 overflow-y-auto">
          {filtered.map((g) => (
            <button
              key={g}
              type="button"
              onMouseDown={() => { onChange(g); setOpen(false); }}
              className="w-full text-right px-3 py-2 text-xs hover:bg-[var(--bg-base)] transition-colors"
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create Order Modal ─────────────────────────────────────────────────
interface NewOrderItem { title: string; variantId?: number; qty: number; price: number }

function CreateOrderModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (o: XenoOrder) => void }) {
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");
  const [city,    setCity]    = useState("");
  const [gov,     setGov]     = useState("");
  const [note,    setNote]    = useState("");
  const [items,   setItems]   = useState<NewOrderItem[]>([]);
  const [saving,  setSaving]  = useState(false);
  const { success, error } = useToast();

  function addProductItem(title: string, variantTitle: string, sku: string, price: number, variantId: number) {
    const displayTitle = variantTitle ? `${title} — ${variantTitle}` : title;
    setItems((p) => [...p, { title: displayTitle, variantId, qty: 1, price }]);
    void sku; // sku stored server-side via variantId
  }
  function removeItem(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: "qty" | "price", val: number) {
    setItems((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  async function handleCreate() {
    if (!name || !phone || !address || !city || !gov) { error("بيانات ناقصة", "اسم العميل والهاتف والعنوان والمدينة والمحافظة مطلوبون"); return; }
    if (items.length === 0) { error("لا توجد منتجات", "أضف منتجاً واحداً على الأقل"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/shopify/orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ customerName: name, phone, address1: address, city, province: gov, note, items, total }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "فشل إنشاء الطلب");
      success("تم إنشاء الطلب", `رقم الطلب: ${data.order.orderNumber}`);
      onCreated(data.order);
      onClose();
      setName(""); setPhone(""); setAddress(""); setCity(""); setGov(""); setNote("");
      setItems([]);
    } catch (err) {
      error("خطأ", String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title="إنشاء طلب جديد" size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button variant="primary" onClick={handleCreate} loading={saving} icon={<Save size={14} />}>
            إنشاء الطلب على Shopify
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Customer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">اسم العميل *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" placeholder="الاسم الكامل" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">رقم الهاتف *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input" dir="ltr" placeholder="01xxxxxxxxx" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">العنوان *</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" placeholder="الشارع / المنطقة" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">المدينة *</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="form-input" placeholder="القاهرة" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">المحافظة *</label>
            <GovPicker value={gov} onChange={setGov} />
          </div>
        </div>

        {/* Items */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">المنتجات *</label>
          {/* Product search */}
          <ProductPicker onSelect={addProductItem} />

          {/* Selected items */}
          {items.length > 0 && (
            <div className="mt-3 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-[var(--bg-base)] rounded-[var(--radius-md)] px-3 py-2">
                  <span className="flex-1 text-xs text-[var(--text-primary)] truncate">{item.title}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <label className="text-[10px] text-[var(--text-muted)]">كمية</label>
                    <input type="number" min={1} value={item.qty}
                      onChange={(e) => updateItem(i, "qty", parseInt(e.target.value) || 1)}
                      className="form-input w-14 text-center text-xs py-1 px-1" />
                    <label className="text-[10px] text-[var(--text-muted)]">سعر</label>
                    <input type="number" min={0} value={item.price}
                      onChange={(e) => updateItem(i, "price", parseFloat(e.target.value) || 0)}
                      className="form-input w-20 text-center text-xs py-1 px-1" dir="ltr" />
                    <span className="text-[10px] text-[var(--text-muted)]">ج.م</span>
                    <button onClick={() => removeItem(i)} className="text-[var(--danger)] hover:opacity-80 mr-1">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="text-left pt-1">
                <span className="text-xs font-bold text-[var(--primary)]" dir="ltr">
                  الإجمالي: {total.toLocaleString("en-US")} ج.م
                </span>
              </div>
            </div>
          )}

          {items.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-2 text-center py-3 border border-dashed border-[var(--border-color)] rounded-[var(--radius-md)]">
              ابحث عن المنتج وانقر على المتغير لإضافته
            </p>
          )}
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">ملاحظات</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            className="form-input min-h-[60px] resize-none" placeholder="ملاحظات اختيارية..." />
        </div>
      </div>
    </Modal>
  );
}

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
  const [createOpen,   setCreateOpen]   = useState(false);
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
        <div className="flex items-center gap-2">
          <Button
            variant="primary" size="sm"
            icon={<Plus size={13} />}
            onClick={() => setCreateOpen(true)}
          >
            طلب جديد
          </Button>
          <Button
            variant="secondary" size="sm"
            icon={loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={14} />}
            onClick={() => { setOrders([]); setNextPageInfo(null); loadOrders(activeTab, search, tagFilter); fetchCount(activeTab); }}
            disabled={loading}
          >
            تحديث
          </Button>
        </div>
      </div>

      {/* Create Order Modal */}
      <CreateOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(newOrder) => { setOrders((prev) => [newOrder, ...prev]); setTotalCount((c) => (c ?? 0) + 1); }}
      />

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
