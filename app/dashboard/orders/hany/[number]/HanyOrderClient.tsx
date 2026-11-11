"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Save, Phone, MapPin, StickyNote, History, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { HANY_STATUS, HANY_PAYMENT, NEXT_STATUS, NEXT_PAYMENT, PAYMENT_METHOD, SOURCE_DISPLAY, hanyToXeno } from "@/lib/hany/labels";
import type { HanyOrder, HanyOrderStatus, HanyPaymentStatus } from "@/lib/hany/types";
import { ShipModal } from "@/components/orders/ShipModal";
import { printOrderLabel } from "@/lib/print-label";
import { Truck, Printer } from "lucide-react";

interface Shipment { tracking_number: string; status: string; label_printed: boolean; provider: string | null }
interface TeamEntry { action: string; detail: string; user: string; at: string }

const SHIPMENT_STATUS: Record<string, string> = {
  pending: "لسه J&T مستلمهاش", picked_up: "J&T استلمها", in_transit: "في الطريق",
  out_for_delivery: "خارجة للتسليم", delivered: "اتسلمت", returned: "مرتجع", failed: "فشل التسليم",
};

function money(n: number) {
  return `${n.toLocaleString("en-US")} ج.م`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function HanyOrderClient({ orderNumber }: { orderNumber: string }) {
  const [order,   setOrder]   = useState<HanyOrder | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy,    setBusy]    = useState<string | null>(null);
  const [notes,   setNotes]   = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [team,     setTeam]     = useState<TeamEntry[]>([]);
  const [shipOpen, setShipOpen] = useState(false);
  const { success, error } = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const api = `/api/hany/orders/${encodeURIComponent(orderNumber)}`;

  async function load() {
    try {
      const res  = await fetch(api);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "تعذر تحميل الطلب");
      setOrder(data.order);
      setNotes(data.order.internal_notes ?? "");
      setShipment(data.shipment ?? null);
      setTeam(data.history ?? []);
      setLoadErr(null);
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : String(err));
    }
  }
  // The page is keyed by order number, so this runs once per order
  // Fetch once on mount (state is set after the response arrives)
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function call(key: string, path: string, method: string, body: unknown, done: string) {
    setBusy(key);
    try {
      const res  = await fetch(`${api}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "فشل التحديث");
      setOrder(data.order);
      setNotes(data.order.internal_notes ?? "");
      success("تم", done);
    } catch (err) {
      error("خطأ", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function moveStatus(to: HanyOrderStatus) {
    if (to === "cancelled" && !(await confirm({
      title: `إلغاء ${orderNumber}؟`, message: "المنتجات هترجع لمخزون HANY، ومينفعش ترجعي الطلب بعد الإلغاء.",
      confirmLabel: "إلغاء الطلب", danger: true,
    }))) return;
    call(`s:${to}`, "/status", "POST", { status: to }, `الطلب بقى «${HANY_STATUS[to].label}»`);
  }

  async function movePayment(to: HanyPaymentStatus) {
    if (to === "refunded" && !(await confirm({ title: "تسجيل الطلب كمسترد؟", confirmLabel: "مسترد", danger: true }))) return;
    call(`p:${to}`, "/payment", "POST", { status: to }, `الدفع بقى «${HANY_PAYMENT[to].label}»`);
  }

  if (loadErr) {
    return (
      <div className="card p-8 text-center space-y-3">
        <p className="text-sm text-[var(--danger)]">{loadErr}</p>
        <div className="flex justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={load} icon={<RefreshCw size={13} />}>حاول تاني</Button>
          <Link href="/dashboard/orders"><Button variant="ghost" size="sm">رجوع للطلبات</Button></Link>
        </div>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="flex items-center justify-center gap-3 p-16">
        <Loader2 size={22} className="animate-spin text-[var(--primary)]" />
        <p className="text-sm text-[var(--text-muted)]">جارٍ تحميل الطلب من HANY...</p>
      </div>
    );
  }

  const st = HANY_STATUS[order.status];
  const pm = HANY_PAYMENT[order.payment_status];
  const area = order.shipping.area && order.shipping.area !== "All areas" ? order.shipping.area : null;

  return (
    <div className="space-y-4">
      {confirmDialog}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/orders" className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-base)] text-[var(--text-muted)]" title="رجوع">
            <ArrowRight size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-page-title font-mono" dir="ltr">{order.order_number}</h1>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${SOURCE_DISPLAY.hany.className}`}>موقع HANY</span>
              <Badge variant={st.variant}>{st.label}</Badge>
              <Badge variant={pm.variant}>{pm.label}</Badge>
            </div>
            <p className="text-small mt-0.5">{formatDate(order.created_at)}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={load} icon={<RefreshCw size={13} />}>تحديث</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Items + totals */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-section-title">المنتجات ({order.items.length})</h2>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {order.items.map((it, i) => (
                <div key={`${it.variant_id}-${i}`} className="flex items-center gap-3 px-4 py-3">
                  {it.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={it.image} alt="" className="w-12 h-12 rounded-[var(--radius-md)] object-cover bg-[var(--bg-base)] flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--bg-base)] flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{it.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {[it.color, it.size].filter(Boolean).join(" / ")}
                      {it.sku && <span className="font-mono mr-2" dir="ltr">{it.sku}</span>}
                    </p>
                  </div>
                  <div className="text-left flex-shrink-0" dir="ltr">
                    <p className="text-xs text-[var(--text-muted)]">{it.quantity} × {money(it.unit_price)}</p>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{money(it.line_total)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-[var(--border-color)] space-y-1 text-xs">
              <div className="flex justify-between text-[var(--text-secondary)]"><span>المنتجات</span><span dir="ltr">{money(order.totals.subtotal)}</span></div>
              {order.totals.discount > 0 && (
                <div className="flex justify-between text-[var(--success)]">
                  <span>خصم{order.totals.discount_code ? ` (${order.totals.discount_code})` : ""}</span>
                  <span dir="ltr">-{money(order.totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--text-secondary)]"><span>الشحن</span><span dir="ltr">{money(order.totals.shipping)}</span></div>
              <div className="flex justify-between font-bold text-sm text-[var(--primary)] pt-1 border-t border-[var(--border-subtle)]">
                <span>الإجمالي</span><span dir="ltr">{money(order.totals.total)}</span>
              </div>
              <p className="text-[var(--text-muted)] pt-1">{PAYMENT_METHOD[order.payment_method] ?? order.payment_method}{order.payment_reference ? ` · ${order.payment_reference}` : ""}</p>
            </div>
          </div>

          {/* Internal notes */}
          <div className="card p-4 space-y-2">
            <h2 className="text-section-title flex items-center gap-2"><StickyNote size={15} /> ملاحظات داخلية</h2>
            <p className="text-[11px] text-[var(--text-muted)]">بتتحفظ على HANY ومش بتظهر للعميل.</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input min-h-[80px] resize-y" placeholder="اكتبي ملاحظة..." />
            <div className="flex justify-end">
              <Button size="sm" icon={<Save size={13} />} loading={busy === "notes"}
                disabled={notes === (order.internal_notes ?? "")}
                onClick={() => call("notes", "", "PATCH", { internal_notes: notes }, "اتحفظت الملاحظة")}>
                حفظ
              </Button>
            </div>
          </div>

          {/* History */}
          <div className="card p-4">
            <h2 className="text-section-title flex items-center gap-2 mb-3"><History size={15} /> سجل الطلب</h2>
            <ol className="space-y-2.5">
              {[...order.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-3 text-xs">
                  <span className="w-2 h-2 rounded-full bg-[var(--primary)] mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-[var(--text-primary)] font-semibold">
                      {h.from && h.from !== h.to
                        ? `${HANY_STATUS[h.from as HanyOrderStatus]?.label ?? h.from} ← ${HANY_STATUS[h.to as HanyOrderStatus]?.label ?? h.to}`
                        : HANY_STATUS[h.to as HanyOrderStatus]?.label ?? h.to}
                    </p>
                    {h.note && <p className="text-[var(--text-muted)]">{h.note}</p>}
                    <p className="text-[10px] text-[var(--text-muted)]">{formatDate(h.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* What the team did from the dashboard (who shipped, printed, changed status…) */}
          {team.length > 0 && (
            <div className="card p-4">
              <h2 className="text-section-title mb-3">إجراءات الفريق</h2>
              <ol className="space-y-2.5">
                {team.map((h, i) => (
                  <li key={i} className="flex gap-3 text-xs">
                    <span className="w-2 h-2 rounded-full bg-[var(--text-muted)] mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[var(--text-primary)]"><b>{h.user}</b> — {h.detail}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{formatDate(h.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Side: customer + actions */}
        <div className="space-y-4">
          {/* J&T — same as Shopify orders */}
          <div className="card p-4 space-y-2">
            <h2 className="text-section-title flex items-center gap-2"><Truck size={15} /> الشحن</h2>
            {shipment ? (
              <>
                <p className="text-xs text-[var(--text-secondary)]">{shipment.provider ?? "J&T Express"} · {SHIPMENT_STATUS[shipment.status] ?? shipment.status}</p>
                <p className="text-sm font-mono font-bold text-[var(--success)]" dir="ltr">{shipment.tracking_number}</p>
                <Button size="sm" variant="secondary" icon={<Printer size={13} />}
                  onClick={async () => {
                    if (!(await confirm({ title: `طباعة بوليصة ${order.order_number}؟`, message: "البوليصة هتتطبع وهتتعلّم Printed على J&T.", confirmLabel: "طباعة" }))) return;
                    printOrderLabel(hanyToXeno(order).shopifyId).catch((err) => error("فشل الطباعة", err instanceof Error ? err.message : String(err)));
                  }}>
                  {shipment.label_printed ? "طباعة تاني" : "طباعة البوليصة"}
                </Button>
              </>
            ) : order.status === "cancelled" ? (
              <p className="text-xs text-[var(--text-muted)]">الطلب ملغي.</p>
            ) : (
              <>
                <p className="text-xs text-[var(--text-muted)]">لسه متشحنش. الشحن على J&T بيبعت رقم التتبع للعميل على واتساب.</p>
                <Button size="sm" icon={<Truck size={13} />} onClick={() => setShipOpen(true)}>إرسال للشحن</Button>
              </>
            )}
          </div>
          {shipOpen && (
            <ShipModal open order={hanyToXeno(order)} onClose={() => setShipOpen(false)} onDone={() => load()} />
          )}

          <div className="card p-4 space-y-2">
            <h2 className="text-section-title">العميل</h2>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{order.customer.name}</p>
            <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)]">
              <Phone size={13} /> <span dir="ltr" className="font-mono">{order.customer.phone}</span>
            </a>
            {order.customer.email && <p className="text-xs text-[var(--text-muted)]" dir="ltr">{order.customer.email}</p>}
            <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)] pt-1">
              <MapPin size={13} className="mt-0.5 flex-shrink-0" />
              <span>{[order.shipping.address, order.shipping.building, area, order.shipping.city].filter(Boolean).join("، ")}</span>
            </div>
            {order.notes && (
              <p className="text-xs bg-[var(--warning-light)] text-[var(--warning-text)] rounded-[var(--radius-md)] p-2 mt-2">
                ملاحظة العميل: {order.notes}
              </p>
            )}
          </div>

          <div className="card p-4 space-y-2">
            <h2 className="text-section-title">حالة الطلب</h2>
            {NEXT_STATUS[order.status].length === 0
              ? <p className="text-xs text-[var(--text-muted)]">الحالة دي نهائية.</p>
              : (
                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUS[order.status].map((to) => (
                    <Button key={to} size="sm" variant={to === "cancelled" ? "danger" : "primary"}
                      loading={busy === `s:${to}`} disabled={busy !== null} onClick={() => moveStatus(to)}>
                      {to === "cancelled" ? "إلغاء الطلب" : `تحويل لـ «${HANY_STATUS[to].label}»`}
                    </Button>
                  ))}
                </div>
              )}
          </div>

          <div className="card p-4 space-y-2">
            <h2 className="text-section-title">الدفع</h2>
            {NEXT_PAYMENT[order.payment_status].length === 0
              ? <p className="text-xs text-[var(--text-muted)]">مفيش تغيير متاح.</p>
              : (
                <div className="flex flex-wrap gap-2">
                  {NEXT_PAYMENT[order.payment_status].map((to) => (
                    <Button key={to} size="sm" variant="secondary"
                      loading={busy === `p:${to}`} disabled={busy !== null} onClick={() => movePayment(to)}>
                      {HANY_PAYMENT[to].label}
                    </Button>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
