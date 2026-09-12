"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, XCircle, Truck, Phone, Mail, MapPin,
  Package, MessageSquare, Printer, Edit2, Tag, Plus, X,
  Loader2, ExternalLink, Save,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { XenoOrder } from "@/lib/shopify/orders";

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
  delivered:  { label: "مكتمل",   variant: "success" },
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
  const [city,     setCity]     = useState(order.city);
  const [gov,      setGov]      = useState(order.governorate);
  const [note,     setNote]     = useState(order.note ?? "");
  const [saving,   setSaving]   = useState(false);
  const { success, error } = useToast();

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/shopify/orders/${order.shopifyId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone, address1: address, city, province: gov, note }),
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
      title="تعديل بيانات الطلب" size="md"
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
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">العنوان</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)}
            className="form-input" placeholder="الشارع / المنطقة" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">المدينة</label>
            <input value={city} onChange={(e) => setCity(e.target.value)}
              className="form-input" placeholder="المدينة" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">المحافظة</label>
            <input value={gov} onChange={(e) => setGov(e.target.value)}
              className="form-input" placeholder="المحافظة" />
          </div>
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

// ── Ship Modal ────────────────────────────────────────────────────────────────
interface ShipModalProps {
  open:    boolean;
  order:   XenoOrder;
  onClose: () => void;
  onDone:  (trackingNumber: string) => void;
}

function ShipModal({ open, order, onClose, onDone }: ShipModalProps) {
  const [step,     setStep]     = useState<"confirm" | "loading" | "success">("confirm");
  const [tracking, setTracking] = useState("");
  const [errMsg,   setErrMsg]   = useState("");
  const { error } = useToast();

  async function ship() {
    setStep("loading");
    setErrMsg("");
    try {
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
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.results?.[0]?.error ?? data.error ?? "فشل الإرسال");

      const r = data.results?.[0];
      if (r?.trackingNumber) {
        setTracking(r.trackingNumber);
        setStep("success");
        onDone(r.trackingNumber);
      } else {
        throw new Error(r?.error ?? "لم يُرجع رقم تتبع");
      }
    } catch (err) {
      setErrMsg(String(err));
      setStep("confirm");
      error("فشل الإرسال للشحن", String(err));
    }
  }

  function close() { setStep("confirm"); setTracking(""); setErrMsg(""); onClose(); }

  return (
    <Modal open={open} onClose={step === "loading" ? () => {} : close}
      title={step === "success" ? "تم الإرسال للشحن ✅" : "إرسال الطلب لـ J&T Express"}
      size="md"
      footer={
        step === "confirm" ? (
          <>
            <Button variant="secondary" onClick={close}>إلغاء</Button>
            <Button variant="primary" onClick={ship} icon={<Truck size={14} />}>تأكيد الإرسال</Button>
          </>
        ) : step === "success" ? (
          <Button variant="primary" onClick={close}>إغلاق</Button>
        ) : undefined
      }
    >
      {step === "confirm" && (
        <div className="space-y-4">
          <div className="bg-[var(--bg-base)] rounded-[var(--radius-lg)] p-4 space-y-2.5">
            {[
              ["رقم الطلب",  order.orderNumber],
              ["العميل",     order.customerName],
              ["الهاتف",     order.customerPhone],
              ["العنوان",    `${order.address}، ${order.city}`],
              ["المحافظة",   order.governorate],
              ["الإجمالي",   `${order.total.toLocaleString("en-US")} ج.م`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-xs text-[var(--text-muted)]">{label}</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">{value}</span>
              </div>
            ))}
          </div>
          {errMsg && (
            <div className="text-xs text-[var(--danger)] bg-[var(--danger-light)] border border-[var(--danger-border)] rounded-[var(--radius-md)] p-3">
              {errMsg}
            </div>
          )}
          <p className="text-xs text-[var(--text-muted)] bg-[var(--warning-light)] border border-[var(--warning-border)] rounded-[var(--radius-md)] p-3">
            سيتم إنشاء شحنة J&T Express وإرسال رقم التتبع تلقائياً للعميل على واتساب
          </p>
        </div>
      )}

      {step === "loading" && (
        <div className="flex flex-col items-center gap-4 py-10">
          <Loader2 size={36} className="animate-spin text-[var(--primary)]" />
          <p className="text-sm text-[var(--text-secondary)] font-medium">جارٍ إنشاء الشحنة على J&T...</p>
        </div>
      )}

      {step === "success" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-14 h-14 rounded-full bg-[var(--success-light)] flex items-center justify-center">
              <CheckCircle2 size={30} className="text-[var(--success)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--text-primary)]">تم إنشاء الشحنة بنجاح</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                رقم التتبع: <span className="font-mono font-bold text-[var(--primary)]">{tracking}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[var(--success-light)] border border-[var(--success-border)] rounded-[var(--radius-md)] p-3">
            <MessageSquare size={15} className="text-[var(--success)]" />
            <p className="text-xs text-[var(--success-text)]">تم إرسال رقم التتبع للعميل على واتساب</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface OrderDetailsClientProps {
  order: XenoOrder;
}

export function OrderDetailsClient({ order: initialOrder }: OrderDetailsClientProps) {
  const [order,       setOrder]       = useState(initialOrder);
  const [editOpen,    setEditOpen]    = useState(false);
  const [shipOpen,    setShipOpen]    = useState(false);

  const st = STATUS_DISPLAY[order.status]  ?? { label: order.status,        variant: "neutral" as const };
  const pm = PAYMENT_DISPLAY[order.paymentStatus] ?? { label: order.paymentStatus, variant: "neutral" as const };

  const canShip = !order.trackingNumber && order.status !== "cancelled" && order.status !== "delivered";

  return (
    <div className="space-y-5">

      {/* ── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/dashboard/orders" className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors">
          <ArrowRight size={15} />الطلبات
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{order.orderNumber}</span>
      </div>

      {/* ── Header Card ────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-page-title">{order.orderNumber}</h1>
              <Badge variant={st.variant}>{st.label}</Badge>
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
              تعديل
            </Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />}
              onClick={() => window.open(`/dashboard/orders/${order.shopifyId}/label`, "_blank")}>
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
      <ShipModal open={shipOpen} order={order} onClose={() => setShipOpen(false)}
        onDone={(tracking) => setOrder((o) => ({ ...o, trackingNumber: tracking, shippingProvider: "J&T Express" }))} />
    </div>
  );
}
