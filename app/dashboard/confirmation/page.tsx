"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CheckCircle2, Clock, HelpCircle, Truck, RefreshCw, Loader2, Send, Calendar, Package } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";

// ── Types ────────────────────────────────────────────────────────────────────
interface WAMessage {
  id: string;
  shopify_order_id: number;
  order_number: string;
  customer_name: string;
  phone: string;
  status: "sent" | "delivered" | "read" | "pending" | "failed";
  sent_at: string | null;
  created_at: string;
  shipped: boolean;
  postponeDate: string | null;
}

interface Stats {
  confirmed: number;
  postponed: number;
  pending: number;
  shipped: number;
}

// ── Date ranges ───────────────────────────────────────────────────────────────
type Range = "today" | "yesterday" | "week" | "all";

function getRange(r: Range): { from: string; to: string } | null {
  const now = new Date();
  const start = (d: Date) => { d.setHours(0, 0, 0, 0); return d.toISOString(); };
  const end   = (d: Date) => { d.setHours(23, 59, 59, 999); return d.toISOString(); };

  if (r === "today") {
    return { from: start(new Date(now)), to: end(new Date(now)) };
  }
  if (r === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { from: start(y), to: end(new Date(y)) };
  }
  if (r === "week") {
    const w = new Date(now); w.setDate(w.getDate() - 7);
    return { from: start(w), to: end(new Date(now)) };
  }
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const RANGES: { key: Range; label: string }[] = [
  { key: "today",     label: "اليوم" },
  { key: "yesterday", label: "أمس" },
  { key: "week",      label: "آخر 7 أيام" },
  { key: "all",       label: "الكل" },
];

// ── Component ────────────────────────────────────────────────────────────────
export default function ConfirmationPage() {
  const [messages,      setMessages]      = useState<WAMessage[]>([]);
  const [stats,         setStats]         = useState<Stats>({ confirmed: 0, postponed: 0, pending: 0, shipped: 0 });
  const [loading,       setLoading]       = useState(true);
  const [shipping,      setShipping]      = useState(false);
  const [range,         setRange]         = useState<Range>("today");
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [postponeModal, setPostponeModal] = useState<WAMessage | null>(null);
  const [postponeDate,  setPostponeDate]  = useState("");
  const [trackingModal, setTrackingModal] = useState<WAMessage | null>(null);
  const [trackingNum,   setTrackingNum]   = useState("");
  const [sendingTrack,  setSendingTrack]  = useState(false);
  const { success, error } = useToast();

  async function load() {
    setLoading(true);
    try {
      const r = getRange(range);
      const qs = r ? `from=${r.from}&to=${r.to}` : "";
      const res  = await fetch(`/api/confirmation?${qs}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setStats(data.stats ?? { confirmed: 0, postponed: 0, pending: 0, shipped: 0 });
      setSelected(new Set());
    } catch {
      error("خطأ", "تعذر تحميل بيانات التأكيدات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [range]);

  // Confirmed + not shipped
  const readyToShip = useMemo(
    () => messages.filter((m) => m.status === "delivered" && !m.shipped),
    [messages]
  );

  async function shipAll() {
    if (!readyToShip.length) return;
    setShipping(true);
    try {
      const res = await fetch("/api/confirmation/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orders: readyToShip.map((m) => ({
            shopify_order_id: m.shopify_order_id,
            order_number:     m.order_number,
            customer_name:    m.customer_name,
            phone:            m.phone,
          })),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        success("تم!", `تم إرسال ${data.count} طلب لـ J&T`);
        load();
      } else {
        error("خطأ", data.error);
      }
    } catch {
      error("خطأ", "فشل الإرسال");
    } finally {
      setShipping(false);
    }
  }

  async function sendTracking() {
    if (!trackingModal || !trackingNum.trim()) return;
    setSendingTrack(true);
    try {
      const res = await fetch("/api/confirmation/send-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopify_order_id: trackingModal.shopify_order_id,
          order_number:     trackingModal.order_number,
          customer_name:    trackingModal.customer_name,
          phone:            trackingModal.phone,
          tracking_number:  trackingNum.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        success("تم!", `تم إرسال رقم التتبع للعميل ${trackingModal.customer_name}`);
        setTrackingModal(null);
        setTrackingNum("");
        load();
      } else {
        error("خطأ", data.error ?? "فشل الإرسال");
      }
    } catch {
      error("خطأ", "فشل الإرسال");
    } finally {
      setSendingTrack(false);
    }
  }

  async function savePostpone() {
    if (!postponeModal || !postponeDate) return;
    await fetch("/api/confirmation/postpone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopify_order_id: postponeModal.shopify_order_id,
        order_number:     postponeModal.order_number,
        date:             postponeDate,
      }),
    });
    success("تم", `تم تحديد يوم المتابعة للطلب #${postponeModal.order_number}`);
    setPostponeModal(null);
    setPostponeDate("");
    load();
  }

  function statusInfo(m: WAMessage): { label: string; variant: "success" | "warning" | "neutral" | "info"; icon: React.ReactNode } {
    if (m.shipped)            return { label: "أُرسل للشحن", variant: "info",    icon: <Truck size={12} /> };
    if (m.status === "delivered") return { label: "مؤكد ✅",  variant: "success", icon: <CheckCircle2 size={12} /> };
    if (m.status === "read")      return { label: "مؤجل ⏳",  variant: "warning", icon: <Clock size={12} /> };
    return                           { label: "لم يرد",    variant: "neutral", icon: <HelpCircle size={12} /> };
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-page-title">إدارة التأكيدات</h1>
          <p className="text-small mt-0.5">متابعة تأكيدات العملاء عبر واتساب</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary" size="sm"
            icon={loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            onClick={load} disabled={loading}
          >تحديث</Button>
          {readyToShip.length > 0 && (
            <Button
              size="sm"
              icon={shipping ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              onClick={shipAll} disabled={shipping}
            >
              {shipping ? "جارٍ الإرسال..." : `إرسال ${readyToShip.length} طلب لـ J&T`}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "مؤكد (جاهز للشحن)", value: stats.confirmed, color: "var(--success)",  icon: <CheckCircle2 size={16} /> },
          { label: "مؤجل",             value: stats.postponed, color: "var(--warning)",  icon: <Clock size={16} /> },
          { label: "لم يرد",           value: stats.pending,   color: "var(--text-muted)", icon: <HelpCircle size={16} /> },
          { label: "أُرسل للشحن",      value: stats.shipped,   color: "var(--primary)",  icon: <Truck size={16} /> },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <p className="text-xl font-bold" style={{ color: s.color }} dir="ltr">{s.value}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Range tabs */}
      <div className="flex items-center gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold transition-all ${
              range === r.key
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >{r.label}</button>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-16">
            <Loader2 size={22} className="animate-spin text-[var(--primary)]" />
            <p className="text-sm text-[var(--text-muted)]">جارٍ تحميل التأكيدات...</p>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={28} />} title="لا توجد تأكيدات" description="لا توجد رسائل واتساب في هذه الفترة" />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>العميل</th>
                  <th>الهاتف</th>
                  <th>الحالة</th>
                  <th>وقت الإرسال</th>
                  <th>يوم التأجيل</th>
                  <th className="text-center">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => {
                  const si = statusInfo(m);
                  return (
                    <tr key={m.id}>
                      <td>
                        <span className="font-mono text-[var(--primary)] font-bold text-xs">#{m.order_number}</span>
                      </td>
                      <td>
                        <span className="text-xs font-medium text-[var(--text-primary)]">{m.customer_name}</span>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-[var(--text-secondary)]" dir="ltr">{m.phone}</span>
                      </td>
                      <td>
                        <Badge variant={si.variant} size="sm" dot>{si.label}</Badge>
                      </td>
                      <td>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {m.created_at ? formatDate(m.created_at) : "—"}
                        </span>
                      </td>
                      <td>
                        {m.postponeDate ? (
                          <span className="text-xs text-[var(--warning)] font-semibold">
                            {new Date(m.postponeDate).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        {m.status === "read" && !m.shipped && (
                          <button
                            onClick={() => { setPostponeModal(m); setPostponeDate(m.postponeDate ?? ""); }}
                            className="text-[11px] px-2 py-1 rounded bg-[var(--bg-base)] text-[var(--warning)] hover:bg-[var(--warning-light)] transition-colors flex items-center gap-1 mx-auto"
                          >
                            <Calendar size={11} /> تحديد يوم
                          </button>
                        )}
                        {m.status === "delivered" && !m.shipped && (
                          <button
                            onClick={() => shipAll()}
                            className="text-[11px] px-2 py-1 rounded bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-80 transition-opacity flex items-center gap-1 mx-auto"
                          >
                            <Truck size={11} /> شحن
                          </button>
                        )}
                        {m.shipped && (
                          <button
                            onClick={() => { setTrackingModal(m); setTrackingNum(""); }}
                            className="text-[11px] px-2 py-1 rounded bg-[var(--bg-base)] text-[var(--success)] hover:opacity-80 transition-opacity flex items-center gap-1 mx-auto"
                          >
                            <Package size={11} /> إرسال تتبع
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tracking modal */}
      <Modal
        open={Boolean(trackingModal)}
        onClose={() => { setTrackingModal(null); setTrackingNum(""); }}
        title={`إرسال رقم التتبع — طلب #${trackingModal?.order_number}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            أدخل رقم تتبع J&T ليُرسَل للعميل <strong>{trackingModal?.customer_name}</strong> عبر واتساب:
          </p>
          <input
            type="text"
            placeholder="مثال: JT1234567890"
            value={trackingNum}
            onChange={(e) => setTrackingNum(e.target.value)}
            className="form-input w-full"
            dir="ltr"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setTrackingModal(null)}>إلغاء</Button>
            <Button
              size="sm"
              icon={sendingTrack ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              onClick={sendTracking}
              disabled={!trackingNum.trim() || sendingTrack}
            >
              {sendingTrack ? "جارٍ الإرسال..." : "إرسال للعميل"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Postpone modal */}
      <Modal
        open={Boolean(postponeModal)}
        onClose={() => { setPostponeModal(null); setPostponeDate(""); }}
        title={`تحديد يوم متابعة — طلب #${postponeModal?.order_number}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            العميل <strong>{postponeModal?.customer_name}</strong> طلب التأجيل.
            حدد اليوم اللي هتتواصل فيه معاه:
          </p>
          <input
            type="date"
            value={postponeDate}
            onChange={(e) => setPostponeDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="form-input w-full"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setPostponeModal(null)}>إلغاء</Button>
            <Button size="sm" onClick={savePostpone} disabled={!postponeDate}>حفظ</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
