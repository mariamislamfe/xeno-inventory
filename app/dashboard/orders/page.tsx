"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { RefreshCw, Eye, Printer, Truck, Loader2, Search, ChevronDown, Tag, X, Plus, Save, CheckCircle2, XCircle, Trash2, RotateCcw, Clock } from "lucide-react";
import type { AddressValue } from "@/components/orders/AddressPicker";
import { phoneKey } from "@/lib/phone";
import { GOV_EN } from "@/lib/shopify/provinces";
import { ShipModal } from "@/components/orders/ShipModal";
import { printOrderLabel } from "@/lib/print-label";
import { saveOrderNav } from "@/lib/order-nav";
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

// ── 3-level Egyptian Address Picker (lazy: carries the full J&T address list) ──
const AddressPicker = dynamic(() => import("@/components/orders/AddressPicker"), {
  ssr: false,
  loading: () => (
    <div className="sm:col-span-2 flex items-center gap-2 p-3 text-xs text-[var(--text-muted)]">
      <Loader2 size={12} className="animate-spin" />
      جارٍ تحميل العناوين...
    </div>
  ),
});

// ── Create Order Modal ─────────────────────────────────────────────────
interface NewOrderItem { title: string; variantId?: number; qty: number; price: number }

function CreateOrderModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (o: XenoOrder, replacedShopifyIds?: number[]) => void }) {
  const [name,          setName]          = useState("");
  const [phone,         setPhone]         = useState("");
  const [address,       setAddress]       = useState("");
  const [gov,           setGov]           = useState("");
  const [city,          setCity]          = useState("");
  const [area,          setArea]          = useState("");
  const [note,          setNote]          = useState("");
  const [items,         setItems]         = useState<NewOrderItem[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [shippingCost,  setShippingCost]  = useState<number>(0);
  const [shippingTitle, setShippingTitle] = useState<string>("الشحن");
  const [loadingShip,   setLoadingShip]   = useState(false);
  const shippingTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const { success, error } = useToast();

  function resetForm() {
    setName(""); setPhone(""); setAddress(""); setGov(""); setCity(""); setArea(""); setNote("");
    setItems([]); setShippingCost(0); setShippingTitle("الشحن");
  }

  function addProductItem(title: string, variantTitle: string, sku: string, price: number, variantId: number) {
    const displayTitle = variantTitle ? `${title} — ${variantTitle}` : title;
    setItems((p) => [...p, { title: displayTitle, variantId, qty: 1, price }]);
    void sku;
  }
  function removeItem(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: "qty" | "price", val: number) {
    setItems((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  const productTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const grandTotal   = productTotal + shippingCost;

  // Fetch shipping rate when governorate or product total changes
  function fetchShipping(province: string, total: number) {
    if (!province) { setShippingCost(0); return; }
    if (shippingTimer.current) clearTimeout(shippingTimer.current);
    shippingTimer.current = setTimeout(async () => {
      setLoadingShip(true);
      try {
        // Shopify stores province names in English — convert from Arabic
        const provEn = GOV_EN[province] ?? province;
        const res  = await fetch(`/api/shopify/shipping-rates?province=${encodeURIComponent(provEn)}&total=${total}`);
        const data = await res.json();
        setShippingCost(data.rate ?? 0);
        if (data.title) setShippingTitle(data.title);
      } catch { /* keep previous */ }
      finally  { setLoadingShip(false); }
    }, 400);
  }

  // Re-fetch shipping when product total changes (Shopify rates can be total-based)
  useEffect(() => {
    if (gov) fetchShipping(gov, productTotal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productTotal]);

  // Shipping rates depend on the governorate only
  function handleAddressChange(next: AddressValue) {
    if (next.province !== gov) fetchShipping(next.province, productTotal);
    setGov(next.province);
    setCity(next.city);
    setArea(next.area);
  }

  async function handleCreate() {
    if (!name || !phone || !address || !gov || !city) { error("بيانات ناقصة", "اسم العميل والهاتف والعنوان والمحافظة والمدينة مطلوبون"); return; }
    if (items.length === 0) { error("لا توجد منتجات", "أضف منتجاً واحداً على الأقل"); return; }
    setSaving(true);
    // Send city as the district/city and province as the governorate
    // If area is selected, prepend it to address1
    const fullAddress = area ? `${area}، ${address}` : address;
    try {
      const res = await fetch("/api/shopify/orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ customerName: name, phone, address1: fullAddress, city, province: gov, note, items, total: grandTotal, shippingCost, shippingTitle }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "فشل إنشاء الطلب");

      const newOrder: XenoOrder   = data.order;
      // Filter existing open orders to only those whose name also matches
      const existing: XenoOrder[] = ((data.existingOpenOrders ?? []) as XenoOrder[])
        .filter((o) => namesMatch(o.customerName, name));

      if (existing.length > 0) {
        // Auto-merge immediately — no prompt
        const all = [newOrder, ...existing];
        const mergeRes  = await fetch("/api/shopify/orders/merge", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ shopifyIds: all.map(o => o.shopifyId) }),
        });
        const mergeData = await mergeRes.json();
        if (mergeRes.ok && mergeData.order) {
          success("تم الدمج التلقائي", `دُمج مع طلب سابق → ${mergeData.order.orderNumber}`);
          onCreated(mergeData.order, existing.map(o => o.shopifyId));
        } else {
          success("تم إنشاء الطلب", `رقم الطلب: ${newOrder.orderNumber}`);
          onCreated(newOrder);
        }
      } else {
        success("تم إنشاء الطلب", `رقم الطلب: ${newOrder.orderNumber}`);
        onCreated(newOrder);
      }

      resetForm();
      onClose();
    } catch (err) {
      error("خطأ", String(err));
    } finally {
      setSaving(false);
    }
  }

  const isBusy = saving;

  return (
    <Modal
      open={open}
      onClose={isBusy ? () => {} : onClose}
      title="إنشاء طلب جديد"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isBusy}>إلغاء</Button>
          <Button variant="primary" onClick={handleCreate} loading={isBusy} icon={<Save size={14} />}>
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
            {/* 3-level address picker: Province → City → Area */}
            <AddressPicker
              value={{ province: gov, city, area }}
              onChange={handleAddressChange}
            />
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">العنوان التفصيلي (الشارع / العقار) *</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" placeholder="اسم الشارع ورقم العقار" />
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">المنتجات *</label>
            <ProductPicker onSelect={addProductItem} />

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
                <div className="border-t border-[var(--border-color)] pt-2 mt-1 space-y-1">
                  <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                    <span>المنتجات</span>
                    <span dir="ltr">{productTotal.toLocaleString("en-US")} ج.م</span>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                    <span>{shippingTitle || "الشحن"}</span>
                    <span dir="ltr">
                      {loadingShip
                        ? <Loader2 size={12} className="inline animate-spin" />
                        : gov
                          ? `${shippingCost.toLocaleString("en-US")} ج.م`
                          : "اختر المحافظة"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-[var(--primary)] border-t border-[var(--border-color)] pt-1">
                    <span>الإجمالي</span>
                    <span dir="ltr">{grandTotal.toLocaleString("en-US")} ج.م</span>
                  </div>
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
  delivered:  { label: "تم التسليم", variant: "info" },
  cancelled:  { label: "ملغي",   variant: "danger"  },
  returned:   { label: "مرتجع",  variant: "neutral" },
};

// "مكتمل" = reviewed and confirmed (the "confirmed" tag), not yet shipped
function isConfirmed(o: XenoOrder) {
  return o.tags.some((t) => t.toLowerCase() === "confirmed");
}
// "انتظار" = on hold (the "waiting" tag)
function isWaiting(o: XenoOrder) {
  return o.tags.some((t) => t.toLowerCase() === "waiting");
}
function statusDisplay(o: XenoOrder) {
  if ((o.status === "pending" || o.status === "processing") && isConfirmed(o)) {
    return { label: "مكتمل", variant: "success" as const };
  }
  if ((o.status === "pending" || o.status === "processing") && isWaiting(o)) {
    return { label: "انتظار", variant: "info" as const };
  }
  return STATUS_DISPLAY[o.status] ?? { label: o.status, variant: "neutral" as const };
}

// ── Order actions (same action for one order or a whole selection) ─────
type OrderAction = "confirm" | "unconfirm" | "wait" | "cancel" | "delete" | "ship";

const ACTION_LABELS: Record<OrderAction, { button: string; done: (n: number) => string; ask?: (n: number) => string }> = {
  confirm:   { button: "مكتمل", done: (n) => n === 1 ? "الطلب بقى مكتمل ✓" : `${n} طلب بقوا مكتملين ✓` },
  unconfirm: { button: "جديد",  done: (n) => n === 1 ? "الطلب رجع جديد"     : `${n} طلب رجعوا جديد` },
  wait:      { button: "انتظار", done: (n) => n === 1 ? "الطلب في الانتظار"  : `${n} طلب في الانتظار` },
  cancel:  { button: "إلغاء الطلبات", done: (n) => n === 1 ? "تم إلغاء الطلب"      : `تم إلغاء ${n} طلب`,
             ask:  (n) => `سيتم إلغاء ${n} طلب على Shopify. متأكد؟` },
  delete:  { button: "حذف",         done: (n) => n === 1 ? "تم حذف الطلب"        : `تم حذف ${n} طلب`,
             ask:  (n) => `سيتم إلغاء وحذف ${n} طلب نهائياً من Shopify، ولا يمكن التراجع عن الحذف. متأكد؟` },
  ship:    { button: "شحن",         done: (n) => n === 1 ? "تم شحن الطلب ✓"     : `تم شحن ${n} طلب ✓`,
             ask:  (n) => `سيتم إنشاء ${n} شحنة على J&T Express وإرسال رقم التتبع لكل عميل على واتساب. الطلبات المشحونة قبل كده هتتخطى. متأكد؟` },
};

// Orders that can still be sent to J&T
function canShip(o: XenoOrder) {
  return !o.trackingNumber && o.status !== "delivered" && o.status !== "cancelled";
}

// Returns the tracking number for "ship"
async function runOrderAction(order: XenoOrder, action: OrderAction): Promise<string | void> {
  if (action === "ship") {
    const res = await fetch("/api/confirmation/ship", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        orders: [{
          shopify_order_id: order.shopifyId,
          order_number:     order.orderNumber,
          customer_name:    order.customerName,
          phone:            order.customerPhone,
          address:          order.address,
          city:             order.city,
          governorate:      order.governorate,
          total:            order.total,
        }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    const r = data.results?.[0];
    if (!res.ok || !r?.ok || !r.trackingNumber) throw new Error(r?.error ?? data.error ?? "فشل إنشاء الشحنة");
    return r.trackingNumber as string;
  }

  const res = await fetch("/api/shopify/orders/status", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ shopifyId: order.shopifyId, action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error ?? "فشل تحديث الحالة");
}

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

// Normalize Arabic name for fuzzy matching (strip diacritics, unify alef forms, collapse spaces)
function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "")   // strip tashkeel + superscript alef
    .replace(/[أإآ]/g, "ا")                   // unify alef variants
    .replace(/ة/g, "ه")                        // teh marbuta → heh
    .replace(/\s+/g, " ");
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  // Accept if first word (first name) matches — handles "محمد" vs "محمد أحمد"
  const firstA = na.split(" ")[0];
  const firstB = nb.split(" ")[0];
  return firstA.length >= 3 && firstA === firstB;
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
type TabKey = "any" | "cancelled" | "fulfilled" | "unfulfilled" | "waiting" | "confirmed" | "postponed";

const TABS: { key: TabKey; label: string; shopifyParam: Record<string, string> }[] = [
  { key: "any",         label: "الكل",        shopifyParam: { status: "any" } },
  { key: "unfulfilled", label: "جديدة",       shopifyParam: { status: "open",   fulfillment_status: "unfulfilled" } },
  { key: "waiting",     label: "⏳ انتظار",   shopifyParam: { status: "open",   tag: "waiting" } },
  { key: "confirmed",   label: "✅ مكتملة",   shopifyParam: { status: "open",   tag: "confirmed" } },
  { key: "cancelled",   label: "ملغية",       shopifyParam: { status: "cancelled" } },
  { key: "fulfilled",   label: "تم التسليم",  shopifyParam: { status: "closed", fulfillment_status: "fulfilled" } },
  { key: "postponed",   label: "⏰ مؤجلة",    shopifyParam: { status: "any",    tag: "postponed" } },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const PAGE_SIZES = [25, 50, 100];

export default function OrdersPage() {
  const [orders,      setOrders]      = useState<XenoOrder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [hasMore,     setHasMore]     = useState(false);
  const [activeTab,   setActiveTab]   = useState<TabKey>("any");
  const [search,      setSearch]      = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [tagFilter,   setTagFilter]   = useState("");
  const [totalCount,  setTotalCount]  = useState<number | null>(null);
  const [createOpen,  setCreateOpen]  = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);
  const [statusMenuId,setStatusMenuId]= useState<string | null>(null);
  // Pagination
  const [pageSize,    setPageSize]    = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  // cursors[i] = cursor needed to fetch page i+1 (cursors[0]=null means page 1 starts fresh)
  const cursors = useRef<(string | null)[]>([null]);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const { success, error } = useToast();

  // Deleting orders is a manager-only feature (also enforced by the API)
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d?.user?.role === "admin"))
      .catch(() => {});
  }, []);

  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;

  // Count only ids still on the page (merges/deletes can remove selected orders)
  const selectedCount = useMemo(() => orders.filter((o) => selectedIds.has(o.id)).length, [orders, selectedIds]);

  // Detect mergeable groups: same phone AND matching name, all open/pending
  const mergeGroups = useMemo(() => {
    const groups = new Map<string, XenoOrder[]>();
    for (const o of orders) {
      if (o.status !== "pending" && o.status !== "processing") continue;
      if (o.trackingNumber) continue; // already sent to J&T — never merge/delete it
      const phone = phoneKey(o.customerPhone); // +20 / 0020 / 0 prefixes → same key
      if (!phone) continue;
      // Group by phone first, then check name within group
      if (!groups.has(phone)) groups.set(phone, []);
      groups.get(phone)!.push(o);
    }
    const result = new Map<string, XenoOrder[]>();
    for (const [phone, group] of groups) {
      if (group.length < 2) continue;
      // Split into sub-groups where all names match each other
      const subGroups: XenoOrder[][] = [];
      for (const order of group) {
        const matched = subGroups.find((sg) => namesMatch(sg[0].customerName, order.customerName));
        if (matched) matched.push(order);
        else subGroups.push([order]);
      }
      subGroups.forEach((sg, i) => {
        if (sg.length >= 2) result.set(`${phone}_${i}`, sg);
      });
    }
    return result;
  }, [orders]);

  // Reflect a successful action in the local list (no refetch needed)
  function applyActionLocally(ids: Set<string>, action: OrderAction, tracking?: Map<string, string>) {
    if (action === "ship") {
      setOrders((prev) => prev.map((o) => tracking?.has(o.id)
        ? { ...o, trackingNumber: tracking.get(o.id)!, shippingProvider: "J&T Express" } : o));
      return;
    }
    if (action === "delete") {
      setOrders((prev) => prev.filter((o) => !ids.has(o.id)));
      setTotalCount((c) => (c != null ? c - ids.size : null));
      return;
    }
    setOrders((prev) => prev.map((o) => {
      if (!ids.has(o.id)) return o;
      const review = o.tags.filter((t) => !["confirmed", "waiting"].includes(t.toLowerCase()));
      if (action === "unconfirm") return { ...o, tags: review };
      if (action === "wait")      return { ...o, tags: [...review, "waiting"] };
      if (action === "cancel")  return { ...o, status: "cancelled" };
      const tags = o.tags.filter((t) => !["cancelled", "postponed", "ملغي", "waiting"].includes(t.toLowerCase()));
      return { ...o, tags: tags.includes("confirmed") ? tags : [...tags, "confirmed"] };
    }));
  }

  async function updateOrderStatus(order: XenoOrder, action: OrderAction) {
    setUpdatingId(order.id);
    try {
      await runOrderAction(order, action);
      applyActionLocally(new Set([order.id]), action);
      success("تم التحديث", ACTION_LABELS[action].done(1));
    } catch (err) {
      error("خطأ", String(err));
    } finally {
      setUpdatingId(null);
    }
  }

  // ── Bulk actions on selected orders ──
  const [shipOrder,    setShipOrder]    = useState<XenoOrder | null>(null);
  const [bulkConfirm,  setBulkConfirm]  = useState<OrderAction | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ action: OrderAction; done: number; total: number } | null>(null);

  async function runBulk(action: OrderAction) {
    setBulkConfirm(null);
    const targets = orders.filter((o) => selectedIds.has(o.id) && (action !== "ship" || canShip(o)));
    if (targets.length === 0) {
      if (action === "ship") error("لا يوجد طلبات للشحن", "كل الطلبات المحددة مشحونة أو مكتملة أو ملغية");
      return;
    }

    setBulkProgress({ action, done: 0, total: targets.length });
    const succeeded = new Set<string>();
    const tracking  = new Map<string, string>();
    const failed: { order: XenoOrder; message: string }[] = [];

    // Small worker pool: Shopify REST allows ~2 requests/second
    let next = 0;
    async function worker() {
      while (next < targets.length) {
        const order = targets[next++];
        try {
          const tn = await runOrderAction(order, action);
          if (tn) tracking.set(order.id, tn);
          succeeded.add(order.id);
        } catch (err) {
          failed.push({ order, message: err instanceof Error ? err.message : String(err) });
        }
        setBulkProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    }
    await Promise.all([worker(), worker()]);

    applyActionLocally(succeeded, action, tracking);
    // Keep only the failed orders selected so they can be retried
    setSelectedIds(new Set(failed.map((f) => f.order.id)));
    setBulkProgress(null);

    if (succeeded.size > 0) success("تم التنفيذ", ACTION_LABELS[action].done(succeeded.size));
    if (failed.length > 0) {
      const sample = failed.slice(0, 3).map((f) => f.order.orderNumber).join("، ");
      error(`فشل ${failed.length} طلب`, `${sample}${failed.length > 3 ? " ..." : ""} — ${failed[0].message.slice(0, 120)}`);
    }
  }

  async function fetchCount(tab: TabKey) {
    try {
      const t  = TABS.find((t) => t.key === tab)!;
      const qs = new URLSearchParams(t.shopifyParam).toString();
      const res  = await fetch(`/api/shopify/orders/count?${qs}`);
      const data = await res.json();
      setTotalCount(data.count ?? null);
    } catch { setTotalCount(null); }
  }

  async function loadOrders(tab: TabKey, q: string, tag: string, page = 1, size = pageSize) {
    setLoading(true);
    try {
      const t      = TABS.find((t) => t.key === tab)!;
      const cursor = cursors.current[page - 1] ?? null;
      const params = new URLSearchParams({ ...t.shopifyParam, limit: String(size) });
      if (cursor) {
        params.set("page_info", cursor);
      } else {
        if (q) params.set("query", q);
        if (tag && !t.shopifyParam.tag) params.set("tag", tag);
      }

      const res  = await fetch(`/api/shopify/orders?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Shopify can't exclude these in the query, so drop them here:
      // "جديدة" = not confirmed / waiting yet; "تم التسليم" = fulfilled orders that weren't cancelled later
      const list = data.orders as XenoOrder[];
      setOrders(
        tab === "unfulfilled" ? list.filter((o) => !isConfirmed(o) && !isWaiting(o))
        : tab === "fulfilled" ? list.filter((o) => o.status !== "cancelled")
        : list,
      );
      setSelectedIds(new Set()); // selection is per loaded page
      setHasMore(data.has_more ?? false);
      setCurrentPage(page);

      // Store cursor for the next page
      if (data.next_page_info) {
        cursors.current[page] = data.next_page_info;
      }
    } catch {
      error("خطأ", "تعذر تحميل الطلبات من Shopify");
    } finally {
      setLoading(false);
    }
  }

  function resetAndLoad(tab: TabKey, q: string, tag: string, size = pageSize) {
    cursors.current = [null];
    setCurrentPage(1);
    loadOrders(tab, q, tag, 1, size);
    fetchCount(tab);
  }

  useEffect(() => {
    resetAndLoad(activeTab, search, tagFilter);
  }, [activeTab, search, tagFilter]);

  // Lets an order page step to the order above / below it in this list
  useEffect(() => { saveOrderNav(orders.map((o) => o.id)); }, [orders]);

  // Auto-merge duplicate groups detected on the loaded page
  const autoMergedKeys = useRef(new Set<string>());
  useEffect(() => {
    if (mergeGroups.size === 0) return;

    const toMerge = [...mergeGroups.values()].filter(group => {
      const key = group.map(o => o.shopifyId).sort().join(",");
      return !autoMergedKeys.current.has(key);
    });
    if (toMerge.length === 0) return;

    toMerge.forEach(group =>
      autoMergedKeys.current.add(group.map(o => o.shopifyId).sort().join(","))
    );

    Promise.all(
      toMerge.map(group =>
        fetch("/api/shopify/orders/merge", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ shopifyIds: group.map(o => o.shopifyId) }),
        }).then(r => r.json())
      )
    ).then(results => {
      results.forEach((data, i) => {
        if (data?.ok && data.order) {
          const removedIds = toMerge[i].map(o => o.id);
          setOrders(prev => [data.order, ...prev.filter(o => !removedIds.includes(o.id))]);
          setTotalCount(c => c != null ? c - (removedIds.length - 1) : null);
        }
      });
      const merged = results.filter(d => d?.ok).length;
      if (merged > 0) success("دمج تلقائي", `تم دمج ${merged} مجموعة طلبات مكررة`);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeGroups.size]);


  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedCount === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  }

  function switchTab(key: TabKey) {
    setActiveTab(key);
  }

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 500);
  }

  function handleTagFilter(val: string) {
    setTagFilter(val);
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size);
    resetAndLoad(activeTab, search, tagFilter, size);
  }

  function goToPage(page: number) {
    if (page < 1 || (totalPages && page > totalPages)) return;
    if (page > 1 && !cursors.current[page - 1]) return; // cursor not yet known
    loadOrders(activeTab, search, tagFilter, page);
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
            onClick={() => resetAndLoad(activeTab, search, tagFilter)}
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
        onCreated={(newOrder, replacedShopifyIds) => {
          if (replacedShopifyIds?.length) {
            // Remove the original orders that got merged-and-cancelled, add the merged result
            setOrders(prev => [newOrder, ...prev.filter(o => !replacedShopifyIds.includes(o.shopifyId))]);
            setTotalCount(c => c != null ? c - (replacedShopifyIds.length - 1) : null);
          } else {
            setOrders(prev => [newOrder, ...prev]);
            setTotalCount(c => (c ?? 0) + 1);
          }
        }}
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

      {/* Selection bar — bulk actions apply to every selected order */}
      {(selectedCount > 0 || bulkProgress) && (
        <div className="card p-3 flex items-center gap-3 flex-wrap border-[var(--primary)] bg-(--primary-light)">
          {bulkProgress ? (
            <span className="flex items-center gap-2 text-xs font-semibold text-[var(--primary)]">
              <Loader2 size={13} className="animate-spin" />
              جارٍ التنفيذ ({ACTION_LABELS[bulkProgress.action].button}) {bulkProgress.done} / {bulkProgress.total}
            </span>
          ) : (
            <>
              <span className="text-xs font-semibold text-[var(--primary)]">
                تم تحديد {selectedCount} طلب
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button variant="secondary" size="sm" icon={<RotateCcw size={13} />} onClick={() => runBulk("unconfirm")}>
                  {ACTION_LABELS.unconfirm.button}
                </Button>
                <Button variant="secondary" size="sm" icon={<Clock size={13} />} onClick={() => runBulk("wait")}>
                  {ACTION_LABELS.wait.button}
                </Button>
                <Button variant="secondary" size="sm" icon={<CheckCircle2 size={13} />} onClick={() => runBulk("confirm")}>
                  {ACTION_LABELS.confirm.button}
                </Button>
                <Button variant="secondary" size="sm" icon={<XCircle size={13} />} onClick={() => setBulkConfirm("cancel")}>
                  {ACTION_LABELS.cancel.button}
                </Button>
                <Button variant="primary" size="sm" icon={<Truck size={13} />} onClick={() => setBulkConfirm("ship")}>
                  {ACTION_LABELS.ship.button}
                </Button>
                {isAdmin && (
                  <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setBulkConfirm("delete")}>
                    {ACTION_LABELS.delete.button}
                  </Button>
                )}
              </div>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors mr-auto"
              >
                إلغاء التحديد
              </button>
            </>
          )}
        </div>
      )}

      {/* Ship straight from the list (truck icon) */}
      {shipOrder && (
        <ShipModal
          open
          order={shipOrder}
          onClose={() => setShipOrder(null)}
          onDone={(tracking) => {
            const id = shipOrder.id;
            setOrders((prev) => prev.map((o) => o.id === id ? { ...o, trackingNumber: tracking, shippingProvider: "J&T Express" } : o));
          }}
        />
      )}

      {/* Confirm destructive bulk actions */}
      <Modal
        open={bulkConfirm !== null}
        onClose={() => setBulkConfirm(null)}
        title={bulkConfirm ? `${ACTION_LABELS[bulkConfirm].button} — ${selectedCount} طلب` : ""}
        size="sm"
        footer={bulkConfirm && (
          <>
            <Button variant="secondary" onClick={() => setBulkConfirm(null)}>رجوع</Button>
            <Button variant={bulkConfirm === "ship" ? "primary" : "danger"} onClick={() => runBulk(bulkConfirm)}>
              {ACTION_LABELS[bulkConfirm].button}
            </Button>
          </>
        )}
      >
        <p className="text-sm text-[var(--text-secondary)]">
          {bulkConfirm && ACTION_LABELS[bulkConfirm].ask?.(
            bulkConfirm === "ship"
              ? orders.filter((o) => selectedIds.has(o.id) && canShip(o)).length
              : selectedCount,
          )}
        </p>
      </Modal>

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
                    <th className="w-8 text-center">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={orders.length > 0 && selectedCount === orders.length}
                        ref={(el) => { if (el) el.indeterminate = selectedCount > 0 && selectedCount < orders.length; }}
                        disabled={bulkProgress !== null}
                        onChange={toggleSelectAll}
                      />
                    </th>
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
                    const st = statusDisplay(order);
                    const pm = PAYMENT_DISPLAY[order.paymentStatus] ?? { label: order.paymentStatus, variant: "neutral" as const };
                    return (
                      <tr key={order.id} className={selectedIds.has(order.id) ? "bg-(--primary-light)" : ""}>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedIds.has(order.id)}
                            onChange={() => toggleSelect(order.id)}
                            disabled={bulkProgress !== null}
                          />
                        </td>
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
                        <td>
                          {order.status === "pending" || order.status === "processing" ? (
                            <div className="relative inline-block">
                              <button
                                onClick={() => setStatusMenuId(statusMenuId === order.id ? null : order.id)}
                                className="flex items-center gap-1"
                                disabled={updatingId === order.id}
                              >
                                <Badge variant={st.variant} size="sm">
                                  {updatingId === order.id
                                    ? <Loader2 size={10} className="inline animate-spin ml-1" />
                                    : null}
                                  {st.label}
                                </Badge>
                                <ChevronDown size={10} className="text-[var(--text-muted)]" />
                              </button>
                              {statusMenuId === order.id && (
                                <>
                                  {/* backdrop to close on outside click */}
                                  <div className="fixed inset-0 z-10" onClick={() => setStatusMenuId(null)} />
                                  <div className="absolute z-20 top-full mt-1 right-0 flex flex-col bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md shadow-lg overflow-hidden min-w-[110px]">
                                    <button
                                      onClick={() => { setStatusMenuId(null); updateOrderStatus(order, "unconfirm"); }}
                                      className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--warning-text)] hover:bg-[var(--bg-base)] transition-colors whitespace-nowrap"
                                    >
                                      <RotateCcw size={13} /> جديد
                                    </button>
                                    <button
                                      onClick={() => { setStatusMenuId(null); updateOrderStatus(order, "wait"); }}
                                      className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--info)] hover:bg-[var(--bg-base)] transition-colors whitespace-nowrap"
                                    >
                                      <Clock size={13} /> انتظار
                                    </button>
                                    <button
                                      onClick={() => { setStatusMenuId(null); updateOrderStatus(order, "confirm"); }}
                                      className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--success)] hover:bg-[var(--bg-base)] transition-colors whitespace-nowrap"
                                    >
                                      <CheckCircle2 size={13} /> مكتمل
                                    </button>
                                    <button
                                      onClick={() => { setStatusMenuId(null); updateOrderStatus(order, "cancel"); }}
                                      className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--danger)] hover:bg-[var(--bg-base)] transition-colors whitespace-nowrap"
                                    >
                                      <XCircle size={13} /> ملغي
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <Badge variant={st.variant} size="sm">{st.label}</Badge>
                          )}
                        </td>
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
                                onClick={() => printOrderLabel(order.shopifyId).catch((err) => error("فشل الطباعة", err instanceof Error ? err.message : String(err)))}>
                                <Printer size={14} />
                              </button>
                            ) : (
                              order.status !== "delivered" && order.status !== "cancelled" && (
                                <button
                                  onClick={() => setShipOrder(order)}
                                  className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
                                  title="إرسال للشحن">
                                  <Truck size={14} />
                                </button>
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

            {/* Pagination */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-[var(--border-subtle)] flex-wrap">
              {/* Page size selector */}
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>عرض</span>
                <div className="flex gap-1">
                  {PAGE_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => handlePageSizeChange(s)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        pageSize === s
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <span>طلب / صفحة</span>
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="px-2 py-1 rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-base)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold"
                >
                  ›
                </button>
                {(() => {
                  const total    = totalPages ?? (currentPage + (hasMore ? 1 : 0));
                  const maxKnown = cursors.current.length;
                  const pages: (number | "…")[] = [];
                  for (let p = 1; p <= Math.min(total, maxKnown + 1); p++) {
                    if (p === 1 || p === total || Math.abs(p - currentPage) <= 2) {
                      pages.push(p);
                    } else if (pages[pages.length - 1] !== "…") {
                      pages.push("…");
                    }
                  }
                  return pages.map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} className="px-1 text-xs text-[var(--text-muted)]">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => goToPage(p as number)}
                        disabled={loading || ((p as number) > 1 && !cursors.current[(p as number) - 1])}
                        className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors ${
                          p === currentPage
                            ? "bg-[var(--primary)] text-white"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-base)] disabled:opacity-40"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={!hasMore || loading}
                  className="px-2 py-1 rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-base)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold"
                >
                  ‹
                </button>
              </div>

              <span className="text-xs text-[var(--text-muted)]">
                {loading
                  ? <Loader2 size={11} className="inline animate-spin" />
                  : `صفحة ${currentPage}${totalPages ? ` / ${totalPages}` : ""}`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
