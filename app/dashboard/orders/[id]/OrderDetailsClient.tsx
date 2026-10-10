"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowRight, ChevronUp, ChevronDown, CheckCircle2, XCircle, Truck, Phone, Mail, MapPin, RotateCcw, Clock,
  Package, MessageSquare, Printer, Edit2, Tag, Plus, X,
  Loader2, ExternalLink, Save, ShoppingBag, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { XenoOrder } from "@/lib/shopify/orders";
import { ShipModal } from "@/components/orders/ShipModal";
import { neighboursFromList } from "@/lib/order-nav";
import { reviewStatus, withStatus, type ReviewStatus } from "@/lib/order-status";
import { printOrderLabel } from "@/lib/print-label";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { AddressValue } from "@/components/orders/AddressPicker";

// Same J&T address picker as the new-order form (lazy: carries the full address list)
const AddressPicker = dynamic(() => import("@/components/orders/AddressPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 p-3 text-xs text-[var(--text-muted)]">
      <Loader2 size={12} className="animate-spin" />
      جارٍ تحميل العناوين...
    </div>
  ),
});

// ── Tag color map ─────────────────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  confirmed:   "bg-green-100  text-green-700",
  cancelled:   "bg-red-100    text-red-700",
  shipped:     "bg-blue-100   text-blue-700",
  returned:    "bg-orange-100 text-orange-700",
  paid:        "bg-emerald-100 text-emerald-700",
  unpaid:      "bg-rose-100   text-rose-700",
  xeno_manual: "bg-purple-100 text-purple-700",
};
function tagStyle(t: string) {
  return TAG_COLORS[t.toLowerCase()] ?? "bg-[var(--bg-base)] text-[var(--text-muted)]";
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_DISPLAY: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  pending:    { label: "جديد",     variant: "warning" },
  processing: { label: "معالجة",  variant: "info"    },
  delivered:  { label: "مكتمل",   variant: "success" },   // fulfilled in Shopify itself
  cancelled:  { label: "ملغي",    variant: "danger"  },
  returned:   { label: "مرتجع",   variant: "neutral" },
};
const PAYMENT_DISPLAY: Record<string, { label: string; variant: "success" | "danger" | "warning" | "neutral" }> = {
  paid:     { label: "مدفوع",     variant: "success" },
  unpaid:   { label: "غير مدفوع", variant: "danger"  },
  partial:  { label: "جزئي",      variant: "warning" },
  refunded: { label: "مسترد",     variant: "neutral" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Product Picker ────────────────────────────────────────────────────────────
interface VariantOpt { id: number; title: string; sku: string; price: number }
interface ProductOpt { id: number; name: string; variants: VariantOpt[] }

function ProductPicker({ onSelect }: { onSelect: (name: string, variant: string, sku: string, price: number, variantId: number) => void }) {
  const [q,       setQ]       = useState("");
  const [results, setResults] = useState<ProductOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  function search(val: string) {
    setQ(val); setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/shopify/products?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setResults((data.products ?? []).map((p: { id: number; name: string; variants: VariantOpt[] }) => p));
      } catch { setResults([]); }
      finally  { setLoading(false); }
    }, 350);
  }

  function pick(p: ProductOpt, v: VariantOpt) {
    onSelect(p.name, v.title, v.sku, v.price, v.id);
    setQ(""); setResults([]); setOpen(false);
  }

  return (
    <div className="relative">
      <input value={q} onChange={(e) => search(e.target.value)}
        onFocus={() => q && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="form-input text-xs w-full"
        placeholder="ابحث عن منتج..." />
      {open && (q.trim() || loading) && (
        <div className="absolute z-50 top-full right-0 left-0 mt-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[var(--radius-md)] shadow-xl max-h-52 overflow-y-auto">
          {loading && <div className="flex items-center gap-2 p-3 text-xs text-[var(--text-muted)]"><Loader2 size={12} className="animate-spin" />جارٍ البحث...</div>}
          {!loading && results.length === 0 && <p className="p-3 text-xs text-[var(--text-muted)]">لم يُعثر على منتجات</p>}
          {results.map((p) => (
            <div key={p.id}>
              <div className="px-3 py-1 text-[11px] font-bold text-[var(--text-muted)] bg-[var(--bg-base)] border-b border-[var(--border-subtle)]">{p.name}</div>
              {p.variants.map((v) => (
                <button key={v.id} onMouseDown={() => pick(p, v)}
                  className="w-full text-right px-3 py-2 hover:bg-[var(--bg-base)] flex items-center justify-between gap-3 transition-colors">
                  <span className="text-xs text-[var(--text-primary)]">
                    {v.title ? `${p.name} — ${v.title}` : p.name}
                  </span>
                  <span className="text-xs font-bold text-[var(--primary)] flex-shrink-0" dir="ltr">{v.price.toLocaleString("en-US")} ج.م</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Edit Items Modal ──────────────────────────────────────────────────────────
interface EditItem { id: string; productName: string; variant: string; sku: string; quantity: number; price: number; variantId?: number }

interface EditItemsModalProps {
  open:    boolean;
  order:   XenoOrder;
  onClose: () => void;
  onSaved: (items: EditItem[], note: string) => void;
}

function EditItemsModal({ open, order, onClose, onSaved }: EditItemsModalProps) {
  const [items,  setItems]  = useState<EditItem[]>(order.items.map((i) => ({ ...i })));
  const [note,   setNote]   = useState(order.note ?? "");
  const [saving, setSaving] = useState(false);
  const { success, error }  = useToast();

  function addFromPicker(name: string, variant: string, sku: string, price: number, variantId: number) {
    const id = `new-${Date.now()}`;
    setItems((p) => [...p, { id, productName: name, variant, sku, quantity: 1, price, variantId }]);
  }
  function remove(id: string)  { setItems((p) => p.filter((i) => i.id !== id)); }
  function update(id: string, field: "quantity" | "price", val: number) {
    setItems((p) => p.map((i) => i.id === id ? { ...i, [field]: val } : i));
  }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  async function handleSave() {
    if (items.length === 0) { error("لا توجد منتجات", "أضف منتجاً واحداً على الأقل"); return; }
    setSaving(true);
    try {
      // 1. Update Shopify via GraphQL FIRST — if it fails, stop here
      const gqlRes = await fetch(`/api/shopify/orders/${order.shopifyId}/edit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          items: items.map((i) => ({
            id:        i.id,
            name:      `${i.productName}${i.variant ? ` (${i.variant})` : ""}`,
            qty:       i.quantity,
            price:     i.price,
            variantId: i.variantId,
          })),
          originalItems: order.items.map((i) => ({ id: i.id, quantity: i.quantity })),
        }),
      });

      if (!gqlRes.ok) {
        const gqlData = await gqlRes.json() as { error?: string };
        error("فشل تعديل الطلب", gqlData.error ?? "خطأ غير معروف");
        return;
      }

      // 2. Shopify succeeded → save items_override locally (J&T uses this)
      await fetch("/api/confirmation/ops", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          shopify_order_id: order.shopifyId,
          order_number:     order.orderNumber,
          customer_name:    order.customerName,
          phone:            order.customerPhone,
          total,
          items_override: items.map((i) => ({ name: i.productName, variant: i.variant, sku: i.sku, qty: i.quantity })),
        }),
      });

      success("تم حفظ التعديلات", "تم تعديل الطلب على Shopify ✓");
      onSaved(items, note);
      onClose();
    } catch (err) {
      error("خطأ", String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose}
      title="تعديل منتجات الطلب" size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} icon={<Save size={14} />}>
            حفظ التعديلات
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {order.trackingNumber && (
          <div className="flex items-start gap-2 text-xs bg-[var(--warning-light)] border border-[var(--warning-border)] text-[var(--warning-text)] rounded-[var(--radius-md)] p-3">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              الطلب ده اتشحن بالفعل على J&T ({order.trackingNumber}). التعديل هيتحفظ في Shopify بس،
              لكن مبلغ التحصيل والمنتجات عند J&T وعلى البوليصة هيفضلوا القديمين — لازم تلغي الشحنة
              وتعيد شحنها عشان المبلغ الجديد يتسجل.
            </span>
          </div>
        )}
        {/* Current items */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">المنتجات الحالية</label>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 bg-[var(--bg-base)] rounded-[var(--radius-md)] px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate block">
                    {item.productName}{item.variant ? ` — ${item.variant}` : ""}
                  </span>
                  {item.sku && <span className="text-[10px] text-[var(--text-muted)] font-mono">{item.sku}</span>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <label className="text-[10px] text-[var(--text-muted)]">×</label>
                  <input type="number" min={1} value={item.quantity}
                    onChange={(e) => update(item.id, "quantity", parseInt(e.target.value) || 1)}
                    className="form-input w-14 text-center text-xs py-1 px-1" />
                  <input type="number" min={0} value={item.price}
                    onChange={(e) => update(item.id, "price", parseFloat(e.target.value) || 0)}
                    className="form-input w-20 text-center text-xs py-1 px-1" dir="ltr" />
                  <span className="text-[10px] text-[var(--text-muted)]">ج.م</span>
                  <button onClick={() => remove(item.id)} className="text-[var(--danger)] hover:opacity-80 ml-1">
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add product */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">إضافة منتج</label>
          <ProductPicker onSelect={addFromPicker} />
        </div>

        {/* Total */}
        <div className="flex justify-between items-center pt-2 border-t border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-muted)]">الإجمالي الجديد</span>
          <span className="text-sm font-bold text-[var(--primary)]" dir="ltr">{total.toLocaleString("en-US")} ج.م</span>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">ملاحظات الطلب</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            className="form-input min-h-[60px] resize-none text-xs"
            placeholder="ملاحظات على الطلب..." />
        </div>
      </div>
    </Modal>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
interface EditModalProps {
  open:    boolean;
  order:   XenoOrder;
  onClose: () => void;
  onSaved: (updated: XenoOrder) => void;
}

function EditModal({ open, order, onClose, onSaved }: EditModalProps) {
  const [phone,    setPhone]    = useState(order.customerPhone);
  const [address,  setAddress]  = useState(order.address);
  const [addr,     setAddr]     = useState<AddressValue>({ province: order.governorate, city: order.city, area: "" });
  const [note,     setNote]     = useState(order.note ?? "");
  const [saving,   setSaving]   = useState(false);
  const { success, error } = useToast();

  // Sync fields from latest order state every time the modal opens
  React.useEffect(() => {
    if (open) {
      setPhone(order.customerPhone);
      setAddress(order.address);
      setAddr({ province: order.governorate, city: order.city, area: "" });
      setNote(order.note ?? "");
      // Map the saved address onto the J&T list (area is stored as a prefix of address1)
      import("@/lib/data/egypt-divisions").then(({ resolveSavedAddress }) => {
        const r = resolveSavedAddress({ governorate: order.governorate, city: order.city, address: order.address });
        setAddr({ province: r.province, city: r.city, area: r.area });
        setAddress(r.street);
      }).catch(() => {});
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!addr.province || !addr.city) { error("بيانات ناقصة", "اختار المحافظة والمدينة"); return; }
    setSaving(true);
    const fullAddress = addr.area ? `${addr.area}، ${address}` : address;
    try {
      const res = await fetch(`/api/shopify/orders/${order.shopifyId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone, address1: fullAddress, city: addr.city, province: addr.province, note }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "فشل الحفظ");
      success("تم الحفظ", "تم تحديث بيانات الطلب على Shopify");
      onSaved(data.order);
      onClose();
    } catch (err) {
      error("خطأ", String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose}
      title="تعديل بيانات الطلب" size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}
            icon={<Save size={14} />}>
            حفظ التعديلات
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">رقم الهاتف</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            className="form-input" dir="ltr" placeholder="01xxxxxxxxx" />
        </div>
        <AddressPicker value={addr} onChange={setAddr} />
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">العنوان التفصيلي (الشارع / العقار)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)}
            className="form-input" placeholder="اسم الشارع ورقم العقار" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">ملاحظات</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            className="form-input min-h-[70px] resize-none" placeholder="ملاحظات إضافية..." />
        </div>
      </div>
    </Modal>
  );
}

// ── Tag Manager ───────────────────────────────────────────────────────────────
interface TagManagerProps {
  tags:    string[];
  orderId: number;
  onUpdate: (tags: string[]) => void;
}

function TagManager({ tags, orderId, onUpdate }: TagManagerProps) {
  const [adding,   setAdding]   = useState(false);
  const [newTag,   setNewTag]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const { success, error } = useToast();

  async function saveTag(updatedTags: string[]) {
    setLoading(true);
    try {
      const res = await fetch(`/api/shopify/orders/${orderId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tags: updatedTags }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "فشل");
      onUpdate(data.order.tags);
      success("تم", "تم تحديث التاجز على Shopify");
    } catch (err) {
      error("خطأ", String(err));
    } finally {
      setLoading(false);
      setAdding(false);
      setNewTag("");
    }
  }

  function removeTag(tag: string) { saveTag(tags.filter((t) => t !== tag)); }
  function addTag()   {
    const t = newTag.trim();
    if (!t || tags.includes(t)) { setAdding(false); return; }
    saveTag([...tags, t]);
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {tags.map((t) => (
        <span key={t} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${tagStyle(t)}`}>
          {t}
          <button onClick={() => removeTag(t)} disabled={loading}
            className="opacity-60 hover:opacity-100 transition-opacity ml-0.5">
            <X size={10} />
          </button>
        </span>
      ))}
      {adding ? (
        <div className="flex items-center gap-1">
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            className="text-xs border border-[var(--border-color)] rounded-[var(--radius-sm)] px-2 py-0.5 w-28 outline-none focus:border-[var(--primary)] bg-[var(--bg-card)]"
            placeholder="اسم التاج..." autoFocus />
          <button onClick={addTag} disabled={loading}
            className="text-[var(--success)] hover:opacity-80 transition-opacity">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          </button>
          <button onClick={() => { setAdding(false); setNewTag(""); }}
            className="text-[var(--text-muted)] hover:opacity-80 transition-opacity">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--primary)] border border-dashed border-[var(--border-color)] hover:border-[var(--primary)] px-2 py-0.5 rounded-full transition-colors">
          <Plus size={10} />إضافة تاج
        </button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface OrderDetailsClientProps {
  order: XenoOrder;
}

// Up = the order above this one in the list, down = the one below it.
// Uses the last orders list (same tab/filter); otherwise asks Shopify for the
// next newer / older order.
function OrderStepper({ order }: { order: XenoOrder }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"up" | "down" | null>(null);
  const { error } = useToast();

  async function go(dir: "up" | "down") {
    setBusy(dir);
    try {
      let target = neighboursFromList(order.id)?.[dir] ?? null;
      if (!target) {
        const qs = new URLSearchParams({ dir, created_at: order.createdAt });
        const res = await fetch(`/api/shopify/orders/${order.shopifyId}/adjacent?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "تعذر جلب الطلب");
        target = data.id;
      }
      if (target) router.push(`/dashboard/orders/${target}`);
      else error(dir === "up" ? "ده أحدث طلب" : "ده أقدم طلب");
    } catch (err) {
      error("خطأ", String(err));
    } finally {
      setBusy(null);
    }
  }

  const btn = "p-1.5 rounded-[var(--radius-sm)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors disabled:opacity-40";
  return (
    <div className="flex items-center gap-1 mr-auto">
      <button className={btn} title="الطلب اللي فوقه" disabled={busy !== null} onClick={() => go("up")}>
        {busy === "up" ? <Loader2 size={15} className="animate-spin" /> : <ChevronUp size={15} />}
      </button>
      <button className={btn} title="الطلب اللي تحته" disabled={busy !== null} onClick={() => go("down")}>
        {busy === "down" ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={15} />}
      </button>
    </div>
  );
}

// Status menu (same four statuses as the orders list). All are tags, so any of
// them can be changed again later.
type StatusAction = "unconfirm" | "wait" | "confirm" | "cancel";
const ACTION_STATUS: Record<StatusAction, ReviewStatus> = { unconfirm: "new", wait: "waiting", confirm: "confirmed", cancel: "cancelled" };

function StatusMenu({ order, label, variant, onChange }: {
  order: XenoOrder;
  label: string;
  variant: "success" | "warning" | "danger" | "info" | "neutral";
  onChange: (tags: string[]) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const { success, error } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  async function apply(action: StatusAction) {
    setMenu(false);
    setBusy(true);
    try {
      const res = await fetch("/api/shopify/orders/status", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ shopifyId: order.shopifyId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "فشل تحديث الحالة");
      onChange(withStatus(order.tags, ACTION_STATUS[action]));
      success("تم التحديث", "اتغيرت حالة الطلب");
    } catch (err) {
      error("خطأ", String(err));
    } finally {
      setBusy(false);
    }
  }

  const items: { action: StatusAction; text: string; icon: React.ReactNode; cls: string }[] = [
    { action: "unconfirm", text: "جديد",   icon: <RotateCcw size={13} />,    cls: "text-[var(--warning-text)]" },
    { action: "wait",      text: "انتظار", icon: <Clock size={13} />,        cls: "text-[var(--info)]" },
    { action: "confirm",   text: "مكتمل",  icon: <CheckCircle2 size={13} />, cls: "text-[var(--success)]" },
    { action: "cancel",    text: "ملغي",   icon: <XCircle size={13} />,      cls: "text-[var(--danger)]" },
  ];
  return (
    <div className="relative inline-block">
      {confirmDialog}
      <button onClick={() => setMenu(!menu)} disabled={busy} className="flex items-center gap-1" title="تغيير الحالة">
        <Badge variant={variant}>
          {busy && <Loader2 size={11} className="inline animate-spin ml-1" />}
          {label}
        </Badge>
        <ChevronDown size={12} className="text-[var(--text-muted)]" />
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute z-20 top-full mt-1 right-0 flex flex-col bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md shadow-lg overflow-hidden min-w-[120px]">
            {items.map((it) => (
              <button key={it.action} onClick={async () => {
                if (it.action === "cancel") {
                  setMenu(false);
                  if (!(await confirm({ title: `تحويل ${order.orderNumber} لـ ملغي؟`, message: "تقدري ترجّعيه لأي حالة تانية بعدين.", confirmLabel: "ملغي", danger: true }))) return;
                }
                apply(it.action);
              }}
                className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--bg-base)] transition-colors whitespace-nowrap ${it.cls}`}>
                {it.icon} {it.text}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrderDetailsClient({ order: initialOrder }: OrderDetailsClientProps) {
  const [order,          setOrder]          = useState(initialOrder);
  const [editOpen,       setEditOpen]       = useState(false);
  const [editItemsOpen,  setEditItemsOpen]  = useState(false);
  const [shipOpen,       setShipOpen]       = useState(false);
  const { error: toastError } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  // "مكتمل" = confirmed (tag), still waiting to be shipped
  const open      = order.status !== "cancelled";   // editable unless cancelled in Shopify itself
  const review    = reviewStatus(order.tags);
  const cancelTag = review === "cancelled";
  const st = open
    ? ({ new: { label: "جديد", variant: "warning" as const }, waiting: { label: "انتظار", variant: "info" as const },
         confirmed: { label: "مكتمل", variant: "success" as const }, cancelled: { label: "ملغي", variant: "danger" as const } })[review]
    : STATUS_DISPLAY.cancelled;
  const pm = PAYMENT_DISPLAY[order.paymentStatus] ?? { label: order.paymentStatus, variant: "neutral" as const };

  const canShip = !order.trackingNumber && order.status !== "cancelled" && !cancelTag;

  return (
    <div className="space-y-5">
      {confirmDialog}

      {/* ── Breadcrumb + previous / next order ────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/dashboard/orders" className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors">
          <ArrowRight size={15} />الطلبات
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{order.orderNumber}</span>
        <OrderStepper order={order} />
      </div>

      {/* ── Header Card ────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-page-title">{order.orderNumber}</h1>
              {open ? (
                <StatusMenu order={order} label={st.label} variant={st.variant}
                  onChange={(tags) => setOrder((o) => ({ ...o, tags }))} />
              ) : (
                <Badge variant={st.variant}>{st.label}</Badge>
              )}
              <Badge variant={pm.variant}>{pm.label}</Badge>
            </div>
            <p className="text-small">{formatDate(order.createdAt)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canShip && (
              <Button variant="primary" size="sm" icon={<Truck size={14} />}
                onClick={() => setShipOpen(true)}>
                إرسال للشحن J&T
              </Button>
            )}
            <Button variant="secondary" size="sm" icon={<Edit2 size={14} />}
              onClick={() => setEditOpen(true)}>
              تعديل البيانات
            </Button>
            <Button variant="secondary" size="sm" icon={<ShoppingBag size={14} />}
              onClick={() => setEditItemsOpen(true)}>
              تعديل المنتجات
            </Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />}
              onClick={async () => {
                if (!(await confirm({ title: `طباعة بوليصة ${order.orderNumber}؟`, message: order.trackingNumber ? "البوليصة هتتطبع وهتتعلّم Printed على J&T." : "هتتطبع بوليصة السيستم (الطلب لسه ماتشحنش على J&T).", confirmLabel: "طباعة" }))) return;
                printOrderLabel(order.shopifyId).catch((err) => toastError("فشل الطباعة", err instanceof Error ? err.message : String(err)));
              }}>
              طباعة
            </Button>
            <a
              href={`https://admin.shopify.com/store/${process.env.NEXT_PUBLIC_SHOPIFY_STORE_HANDLE ?? "xeno-eg"}/orders/${order.shopifyId}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--primary)] border border-[var(--border-color)] rounded-[var(--radius-md)] px-3 py-1.5 transition-colors"
            >
              <ExternalLink size={12} />فتح في Shopify
            </a>
          </div>
        </div>

        {/* Tracking */}
        {order.trackingNumber && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-3">
            <Truck size={15} className="text-[var(--success)]" />
            <div>
              <p className="text-[11px] text-[var(--text-muted)]">رقم التتبع · {order.shippingProvider ?? "J&T Express"}</p>
              <span className="font-mono text-sm font-bold text-[var(--primary)]">{order.trackingNumber}</span>
            </div>
          </div>
        )}

        {/* Tags */}
        {(order.tags.length > 0 || true) && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 mb-2">
              <Tag size={13} className="text-[var(--text-muted)]" />
              <span className="text-xs font-semibold text-[var(--text-muted)]">تاجز Shopify</span>
            </div>
            <TagManager
              tags={order.tags}
              orderId={order.shopifyId}
              onUpdate={(newTags) => setOrder((o) => ({ ...o, tags: newTags }))}
            />
          </div>
        )}
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left: Items */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <h2 className="text-section-title mb-4">منتجات الطلب</h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>المتغير</th>
                    <th>SKU</th>
                    <th>السعر</th>
                    <th>الكمية</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--bg-base)] flex items-center justify-center flex-shrink-0">
                            <Package size={14} className="text-[var(--text-muted)]" />
                          </div>
                          <span className="text-xs font-medium text-[var(--text-primary)]">{item.productName}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-[var(--text-muted)]">{item.variant || "—"}</span>
                      </td>
                      <td>
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">{item.sku || "—"}</span>
                      </td>
                      <td>
                        <span className="text-xs" dir="ltr">{item.price.toLocaleString("en-US")} ج.م</span>
                      </td>
                      <td>
                        <span className="text-xs font-bold text-center">{item.quantity}</span>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-[var(--primary)]" dir="ltr">
                          {(item.price * item.quantity).toLocaleString("en-US")} ج.م
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex justify-end">
              <div className="space-y-1.5 min-w-[200px]">
                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                  <span>المجموع</span>
                  <span dir="ltr">{order.total.toLocaleString("en-US")} ج.م</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-[var(--border-subtle)] pt-1.5">
                  <span className="text-[var(--text-primary)]">الإجمالي</span>
                  <span className="text-[var(--primary)]" dir="ltr">{order.total.toLocaleString("en-US")} ج.م</span>
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          {order.note && (
            <div className="card p-5">
              <h2 className="text-section-title mb-2">ملاحظات الطلب</h2>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{order.note}</p>
            </div>
          )}
        </div>

        {/* Right: Customer + Actions */}
        <div className="space-y-5">

          {/* Customer Info */}
          <div className="card p-5">
            <h2 className="text-section-title mb-4">بيانات العميل</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {order.customerName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{order.customerName}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{order.email}</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <a href={`tel:${order.customerPhone}`}
                  className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors group">
                  <Phone size={13} className="text-[var(--text-muted)] group-hover:text-[var(--primary)]" />
                  <span dir="ltr">{order.customerPhone || "—"}</span>
                </a>
                <a href={`mailto:${order.email}`}
                  className="flex items-center gap-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
                  <Mail size={13} className="text-[var(--text-muted)]" />
                  <span dir="ltr" className="truncate">{order.email || "—"}</span>
                </a>
                <div className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
                  <MapPin size={13} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                  <span>{[order.address, order.city, order.governorate].filter(Boolean).join("، ")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-5">
            <h2 className="text-section-title mb-4">إجراءات سريعة</h2>
            <div className="space-y-2">
              {canShip && (
                <Button variant="primary" className="w-full" size="sm"
                  icon={<Truck size={14} />}
                  onClick={() => setShipOpen(true)}>
                  إرسال للشحن J&T
                </Button>
              )}
              <Button variant="secondary" className="w-full" size="sm"
                icon={<Edit2 size={14} />}
                onClick={() => setEditOpen(true)}>
                تعديل البيانات
              </Button>
              <Button variant="secondary" className="w-full" size="sm"
                icon={<ShoppingBag size={14} />}
                onClick={() => setEditItemsOpen(true)}>
                تعديل المنتجات
              </Button>
              <a href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-color)] rounded-[var(--radius-md)] px-3 py-2 hover:bg-[var(--bg-base)] hover:text-[var(--primary)] transition-colors">
                <MessageSquare size={13} />
                تواصل على واتساب
              </a>
              {order.trackingNumber && (
                <a href={`https://jtexpress.com.eg/track?number=${order.trackingNumber}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-[var(--success)] bg-[var(--success-light)] border border-[var(--success-border)] rounded-[var(--radius-md)] px-3 py-2 hover:opacity-90 transition-opacity">
                  <ExternalLink size={13} />
                  تتبع الشحنة
                </a>
              )}
            </div>
          </div>

          {/* Status Info */}
          <div className="card p-5">
            <h2 className="text-section-title mb-3">حالة الطلب</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">حالة الطلب</span>
                <Badge variant={st.variant} size="sm">{st.label}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">حالة الدفع</span>
                <Badge variant={pm.variant} size="sm">{pm.label}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">شركة الشحن</span>
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {order.shippingProvider ?? (order.trackingNumber ? "J&T Express" : "—")}
                </span>
              </div>
              {order.trackingNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">رقم التتبع</span>
                  <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-full">
                    {order.trackingNumber}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EditModal open={editOpen} order={order} onClose={() => setEditOpen(false)}
        onSaved={(updated) => setOrder(updated)} />
      <EditItemsModal
        open={editItemsOpen}
        order={order}
        onClose={() => setEditItemsOpen(false)}
        onSaved={(items, note) => setOrder((o) => ({
          ...o,
          items: items.map((i) => ({
            id:          i.id,
            productName: i.productName,
            variant:     i.variant,
            sku:         i.sku,
            quantity:    i.quantity,
            price:       i.price,
          })),
          note,
          total: items.reduce((s, i) => s + i.price * i.quantity, 0),
        }))}
      />
      <ShipModal open={shipOpen} order={order} onClose={() => setShipOpen(false)}
        onDone={(tracking) => setOrder((o) => ({ ...o, trackingNumber: tracking, shippingProvider: "J&T Express" }))} />
    </div>
  );
}
