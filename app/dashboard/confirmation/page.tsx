"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2, XCircle, HelpCircle, Truck, RefreshCw, Loader2,
  Clock, MessageSquare, AlertCircle, Package, Phone, Calendar,
  ChevronDown, Send,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import type { OpStatus } from "@/app/api/confirmation/ops/route";

// ── Types ──────────────────────────────────────────────────────────────────────
interface WAMessage {
  id: string;
  shopify_order_id: number;
  order_number: string;
  customer_name: string;
  phone: string;
  status: "sent" | "delivered" | "read" | "failed";
  created_at: string;
  shipped: boolean;
}

interface XenoOp {
  shopify_order_id: number;
  order_number: string;
  customer_name?: string;
  phone?: string;
  total?: number;
  op_status: OpStatus;
  postponed_until?: string | null;
  inquiry_type?: string | null;
  internal_note?: string | null;
  updated_at?: string;
}

interface OpRow extends WAMessage {
  op_status: OpStatus;
  postponed_until?: string | null;
  inquiry_type?: string | null;
  internal_note?: string | null;
}

type TabKey = "pending" | "confirmed" | "postponed" | "inquiry" | "cancelled" | "shipped";

const TABS: { key: TabKey; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "pending",   label: "انتظار رد",    icon: <HelpCircle   size={14} />, color: "var(--text-muted)"       },
  { key: "confirmed", label: "مؤكد - جاهز",  icon: <CheckCircle2 size={14} />, color: "var(--success)"          },
  { key: "postponed", label: "مؤجل",          icon: <Clock        size={14} />, color: "#d97706"                 },
  { key: "inquiry",   label: "استفسار",        icon: <HelpCircle   size={14} />, color: "var(--primary)"         },
  { key: "cancelled", label: "ملغي",           icon: <XCircle      size={14} />, color: "var(--danger)"          },
  { key: "shipped",   label: "شُحن",           icon: <Truck        size={14} />, color: "#3b82f6"                },
];

const INQUIRY_TYPES = ["سؤال عن المنتج", "مشكلة في الطلب", "تعديل الطلب", "مشكلة في الدفع", "أخرى"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatPostponeDate(iso: string) {
  const d   = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isPast  = d < now;
  const label   = d.toLocaleDateString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return { label, isToday, isPast };
}

// ── Action Modal ───────────────────────────────────────────────────────────────
interface ActionModalProps {
  row:     OpRow | null;
  onClose: () => void;
  onSaved: (updated: Partial<XenoOp>) => void;
}

function ActionModal({ row, onClose, onSaved }: ActionModalProps) {
  const [action,      setAction]      = useState<OpStatus | null>(null);
  const [date,        setDate]        = useState("");
  const [time,        setTime]        = useState("10:00");
  const [inquiryType, setInquiryType] = useState(INQUIRY_TYPES[0]);
  const [note,        setNote]        = useState("");
  const [saving,      setSaving]      = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    if (row) {
      setAction(null); setDate(""); setTime("10:00");
      setNote(row.internal_note ?? "");
      setInquiryType(row.inquiry_type ?? INQUIRY_TYPES[0]);
    }
  }, [row]);

  async function save() {
    if (!row || !action) return;
    setSaving(true);

    const postponed_until: string | null =
      action === "postponed" && date
        ? new Date(`${date}T${time}:00`).toISOString()
        : null;

    const payload: Partial<XenoOp> = {
      shopify_order_id: row.shopify_order_id,
      order_number:     row.order_number,
      customer_name:    row.customer_name,
      phone:            row.phone,
      op_status:        action,
      postponed_until:  action === "postponed" ? postponed_until : null,
      inquiry_type:     action === "inquiry"   ? inquiryType    : null,
      internal_note:    note || null,
    };

    try {
      const res = await fetch("/api/confirmation/ops", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "فشل الحفظ");
      success("تم التحديث", `الطلب ${row.order_number} → "${TABS.find((t) => t.key === action)?.label}"`);
      onSaved(payload);
      onClose();
    } catch (err) {
      error("خطأ", String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!row) return null;

  return (
    <Modal
      open={Boolean(row)}
      onClose={saving ? () => {} : onClose}
      title={`إجراء على طلب ${row.order_number}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!action}>حفظ الإجراء</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Customer info */}
        <div className="bg-[var(--bg-base)] rounded-[var(--radius-md)] p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {row.customer_name?.charAt(0) ?? "؟"}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{row.customer_name}</p>
            <a href={`https://wa.me/${row.phone?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[var(--text-muted)] hover:text-green-600 flex items-center gap-1" dir="ltr">
              <MessageSquare size={11} /> {row.phone}
            </a>
          </div>
          <Link href={`/dashboard/orders/${row.shopify_order_id}`}
            className="mr-auto text-xs text-[var(--primary)] hover:underline">
            فتح الطلب ←
          </Link>
        </div>

        {/* Action buttons */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">نقل الطلب إلى</label>
          <div className="grid grid-cols-2 gap-2">
            {(["confirmed", "postponed", "cancelled", "inquiry"] as OpStatus[]).map((s) => {
              const tab = TABS.find((t) => t.key === s)!;
              return (
                <button
                  key={s}
                  onClick={() => setAction(s)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] border text-xs font-semibold transition-all ${
                    action === s
                      ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                      : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--primary)]"
                  }`}
                >
                  <span style={{ color: tab.color }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Postpone inputs */}
        {action === "postponed" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">تاريخ المتابعة</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="form-input" min={new Date().toISOString().split("T")[0]} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">الوقت</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="form-input" />
            </div>
          </div>
        )}

        {/* Inquiry type */}
        {action === "inquiry" && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">نوع الاستفسار</label>
            <div className="relative">
              <select value={inquiryType} onChange={(e) => setInquiryType(e.target.value)}
                className="form-input w-full appearance-none pr-3 pl-8">
                {INQUIRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            </div>
          </div>
        )}

        {/* Internal note */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">ملاحظة داخلية (اختياري)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            className="form-input min-h-[70px] resize-none text-xs"
            placeholder="مثال: قال هيتصل بعد الشغل، عنده سؤال عن الألوان..." />
        </div>
      </div>
    </Modal>
  );
}

// ── Row Card ───────────────────────────────────────────────────────────────────
interface RowCardProps {
  row:       OpRow;
  onAction:  (row: OpRow) => void;
  onShipped: (row: OpRow) => void;
}

function RowCard({ row, onAction, onShipped }: RowCardProps) {
  const [shipping, setShipping] = useState(false);
  const { success, error } = useToast();
  const postponeInfo = row.postponed_until ? formatPostponeDate(row.postponed_until) : null;
  const isOverdue    = postponeInfo?.isPast && !postponeInfo.isToday;

  async function handleShip() {
    setShipping(true);
    try {
      const res = await fetch("/api/confirmation/ship", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orders: [{
            shopify_order_id: row.shopify_order_id,
            order_number:     row.order_number,
            customer_name:    row.customer_name,
            phone:            row.phone,
          }],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.results?.[0]?.error ?? data.error ?? "فشل الشحن");
      const tracking = data.results?.[0]?.trackingNumber ?? "";
      success("تم الشحن ✅", `رقم التتبع: ${tracking}`);
      onShipped(row);
    } catch (err) {
      error("فشل الشحن", String(err));
    } finally {
      setShipping(false);
    }
  }

  return (
    <div className={`card p-4 flex flex-col sm:flex-row gap-3 transition-all ${
      isOverdue ? "border-r-2 border-[var(--danger)]" : ""
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <Link href={`/dashboard/orders/${row.shopify_order_id}`}
            className="font-mono text-sm font-bold text-[var(--primary)] hover:underline">
            {row.order_number}
          </Link>
          {row.inquiry_type && (
            <span className="text-[11px] bg-[var(--primary-light)] text-[var(--primary)] px-2 py-0.5 rounded-full font-medium">
              {row.inquiry_type}
            </span>
          )}
          {isOverdue && (
            <span className="text-[11px] bg-[var(--danger-light)] text-[var(--danger)] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <AlertCircle size={10} /> متأخر
            </span>
          )}
          {postponeInfo?.isToday && !isOverdue && (
            <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <Clock size={10} /> اليوم
            </span>
          )}
          {row.shipped && (
            <Badge variant="info" size="sm" dot>شُحن</Badge>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap text-xs text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">{row.customer_name}</span>
          <a href={`https://wa.me/${row.phone?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-green-600 transition-colors" dir="ltr">
            <Phone size={11} /> {row.phone}
          </a>
          {row.created_at && (
            <span className="text-[var(--text-muted)]">{formatDate(row.created_at)}</span>
          )}
        </div>

        {row.internal_note && (
          <p className="text-xs text-[var(--text-secondary)] mt-1.5 bg-[var(--bg-base)] px-2 py-1 rounded-[var(--radius-sm)] line-clamp-2">
            📝 {row.internal_note}
          </p>
        )}

        {postponeInfo && (
          <p className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${
            isOverdue ? "text-[var(--danger)]" : "text-amber-700"
          }`}>
            <Calendar size={11} /> موعد المتابعة: {postponeInfo.label}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex sm:flex-col items-center gap-2 flex-shrink-0">
        {row.op_status === "confirmed" && !row.shipped && (
          <button
            onClick={handleShip}
            disabled={shipping}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {shipping ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            شحن J&T
          </button>
        )}
        <button
          onClick={() => onAction(row)}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] border border-[var(--border-color)] hover:border-[var(--primary)] px-3 py-1.5 rounded-[var(--radius-md)] transition-colors whitespace-nowrap"
        >
          تغيير الحالة
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ConfirmationPage() {
  const [rows,        setRows]        = useState<OpRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<TabKey>("pending");
  const [actionRow,   setActionRow]   = useState<OpRow | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const { error } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [waRes, opsRes] = await Promise.all([
        fetch("/api/confirmation"),
        fetch("/api/confirmation/ops"),
      ]);
      const waData  = await waRes.json();
      const opsData = await opsRes.json();

      if (opsData.setup_needed) setSetupNeeded(true);

      const messages: WAMessage[] = waData.messages ?? [];
      const ops:      XenoOp[]   = opsData.ops ?? [];
      const opsMap = new Map<number, XenoOp>(ops.map((o) => [o.shopify_order_id, o]));

      const merged: OpRow[] = messages.map((m) => {
        const op = opsMap.get(m.shopify_order_id);
        let defaultStatus: OpStatus;
        if (m.shipped)               defaultStatus = "shipped";
        else if (m.status === "delivered") defaultStatus = "confirmed";
        else if (m.status === "read")      defaultStatus = "cancelled";
        else                               defaultStatus = "pending";

        return {
          ...m,
          op_status:       op?.op_status       ?? defaultStatus,
          postponed_until: op?.postponed_until  ?? null,
          inquiry_type:    op?.inquiry_type     ?? null,
          internal_note:   op?.internal_note    ?? null,
        };
      });

      // Also include manual ops not in WA messages
      ops.forEach((op) => {
        if (!messages.some((m) => m.shopify_order_id === op.shopify_order_id)) {
          merged.push({
            id:               String(op.shopify_order_id),
            shopify_order_id: op.shopify_order_id,
            order_number:     op.order_number,
            customer_name:    op.customer_name ?? "",
            phone:            op.phone ?? "",
            status:           "sent",
            created_at:       op.updated_at ?? new Date().toISOString(),
            shipped:          op.op_status === "shipped",
            op_status:        op.op_status,
            postponed_until:  op.postponed_until ?? null,
            inquiry_type:     op.inquiry_type    ?? null,
            internal_note:    op.internal_note   ?? null,
          });
        }
      });

      setRows(merged);
    } catch {
      error("خطأ", "تعذر تحميل بيانات التأكيدات");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const m: Record<TabKey, number> = {
      pending: 0, confirmed: 0, postponed: 0, inquiry: 0, cancelled: 0, shipped: 0,
    };
    rows.forEach((r) => {
      const key = r.shipped ? "shipped" : r.op_status;
      m[key as TabKey] = (m[key as TabKey] ?? 0) + 1;
    });
    return m;
  }, [rows]);

  const visibleRows = useMemo(
    () => rows.filter((r) =>
      activeTab === "shipped" ? r.shipped : (!r.shipped && r.op_status === activeTab)
    ),
    [rows, activeTab]
  );

  const overdueCount = useMemo(
    () => rows.filter((r) => r.op_status === "postponed" && r.postponed_until && new Date(r.postponed_until) <= new Date()).length,
    [rows]
  );

  function handleSaved(updated: Partial<XenoOp>) {
    setRows((prev) =>
      prev.map((r) => r.shopify_order_id === updated.shopify_order_id ? { ...r, ...updated } : r)
    );
    setActionRow(null);
  }

  function handleShipped(row: OpRow) {
    setRows((prev) =>
      prev.map((r) => r.shopify_order_id === row.shopify_order_id ? { ...r, shipped: true, op_status: "shipped" as OpStatus } : r)
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-page-title">مركز العمليات</h1>
          <p className="text-small mt-0.5">إدارة التأكيدات، المتابعة، والشحن من مكان واحد</p>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <button
              onClick={() => setActiveTab("postponed")}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--danger)] bg-[var(--danger-light)] border border-[var(--danger-border,#fecaca)] px-3 py-1.5 rounded-[var(--radius-md)]"
            >
              <AlertCircle size={13} /> {overdueCount} مؤجل متأخر
            </button>
          )}
          <Button
            variant="secondary" size="sm"
            icon={loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            onClick={load} disabled={loading}
          >تحديث</Button>
        </div>
      </div>

      {/* Setup banner */}
      {setupNeeded && (
        <div className="bg-amber-50 border border-amber-200 rounded-[var(--radius-lg)] p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">إعداد قاعدة البيانات مطلوب</p>
            <p className="text-xs text-amber-700 mt-1">
              شغّل ملف <code className="font-mono bg-amber-100 px-1 rounded">supabase/xeno_ops.sql</code> في Supabase SQL Editor لتفعيل حفظ حالات الطلبات.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`card p-3 flex flex-col items-center gap-1 text-center transition-all hover:opacity-90 ${
              activeTab === tab.key ? "ring-2 ring-[var(--primary)] ring-offset-1" : ""
            }`}
          >
            <span style={{ color: tab.color }}>{tab.icon}</span>
            <span className="text-lg font-bold" style={{ color: tab.color }}>{counts[tab.key]}</span>
            <span className="text-[10px] text-[var(--text-muted)] leading-tight">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === tab.key
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.icon}
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? "bg-white/20" : "bg-[var(--border-color)]"
              }`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 p-16">
          <Loader2 size={22} className="animate-spin text-[var(--primary)]" />
          <p className="text-sm text-[var(--text-muted)]">جارٍ التحميل...</p>
        </div>
      ) : visibleRows.length === 0 ? (
        <EmptyState
          icon={TABS.find((t) => t.key === activeTab)?.icon ?? <Package size={28} />}
          title={`لا توجد طلبات في "${TABS.find((t) => t.key === activeTab)?.label}"`}
          description="لا توجد طلبات في هذه الحالة حالياً"
        />
      ) : (
        <div className="space-y-3">
          {visibleRows.map((row) => (
            <RowCard
              key={row.id}
              row={row}
              onAction={setActionRow}
              onShipped={handleShipped}
            />
          ))}
        </div>
      )}

      <ActionModal
        row={actionRow}
        onClose={() => setActionRow(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
