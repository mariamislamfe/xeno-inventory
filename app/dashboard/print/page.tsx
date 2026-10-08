"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Loader2, RefreshCw, Search, CheckCircle2, Eye, CalendarDays, Package, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { printOrderLabel, printOrderLabels } from "@/lib/print-label";

// Shipped orders waiting for their J&T waybill to be printed. Printing goes through
// J&T's print API, which is what moves the order to "Printed" on the J&T side.
interface PrintRow {
  id:               string;
  shopify_order_id: number;
  order_number:     string;
  tracking_number:  string;
  customer_name:    string | null;
  phone:            string | null;
  city:             string | null;
  governorate:      string | null;
  created_at:       string;
  items:            { sku: string; name: string; variant: string; qty: number }[];
}

// Day the order was shipped, in the viewer's local time (YYYY-MM-DD)
function localDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA");
}
function dayLabel(day: string) {
  const today = localDay(new Date().toISOString());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (day === today) return "النهارده";
  if (day === localDay(y.toISOString())) return "امبارح";
  return new Date(day + "T12:00:00").toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short" });
}
const skuKey = (s: string) => s.trim().toUpperCase();

type Tab = "pending" | "printed";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PrintPage() {
  const [tab,        setTab]        = useState<Tab>("pending");
  const [rows,       setRows]       = useState<PrintRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [bulk,       setBulk]       = useState<{ done: number; total: number } | null>(null);
  const [day,        setDay]        = useState("");   // "" = all days
  const [sku,        setSku]        = useState("");   // "" = all products
  const { success, error } = useToast();

  async function fetchRows(t: Tab): Promise<PrintRow[]> {
    const res  = await fetch(`/api/print?printed=${t === "printed" ? 1 : 0}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? "فشل التحميل");
    return data.shipments;
  }

  function reload(t: Tab) {
    setLoading(true);
    setSelected(new Set());
    fetchRows(t)
      .then(setRows)
      .catch((err) => { error("خطأ", String(err)); setRows([]); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchRows("pending")
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  // Days that have shipments, newest first, with counts (quick-pick chips)
  const days = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => { const d = localDay(r.created_at); m.set(d, (m.get(d) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  // SKUs in the current list (for the suggestions), counted in pieces
  const skus = useMemo(() => {
    const m = new Map<string, { label: string; pieces: number }>();
    rows.forEach((r) => r.items.forEach((i) => {
      if (!i.sku.trim()) return;
      const k = skuKey(i.sku);
      const cur = m.get(k) ?? { label: `${i.sku.trim()} — ${i.name}`, pieces: 0 };
      cur.pieces += i.qty;
      m.set(k, cur);
    }));
    return [...m.entries()].sort((a, b) => b[1].pieces - a[1].pieces);
  }, [rows]);

  const skuQuery = skuKey(sku);
  // exact SKU when it's one we know (NK2 shouldn't also pick NK20), else partial
  const skuExact = skuQuery !== "" && skus.some(([k]) => k === skuQuery);
  function hasSku(r: PrintRow) {
    return r.items.some((i) => skuExact ? skuKey(i.sku) === skuQuery : skuKey(i.sku).includes(skuQuery));
  }

  const filtered = useMemo(() => {
    const q = search.trim();
    return rows.filter((r) =>
      (!day || localDay(r.created_at) === day) &&
      (!skuQuery || hasSku(r)) &&
      (!q || [r.order_number, r.tracking_number, r.customer_name, r.phone].some((v) => v?.includes(q))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, day, skuQuery, skuExact]);

  // Pieces of the chosen SKU across the filtered orders
  const skuPieces = skuQuery
    ? filtered.reduce((n, r) => n + r.items.filter((i) => skuExact ? skuKey(i.sku) === skuQuery : skuKey(i.sku).includes(skuQuery)).reduce((a, i) => a + i.qty, 0), 0)
    : 0;

  // Already-printed labels only: shows it on screen, nothing is printed or recorded
  async function previewLabel(row: PrintRow) {
    try {
      await printOrderLabel(row.shopify_order_id, { preview: true });
    } catch (err) {
      error("فشل المعاينة", err instanceof Error ? err.message : String(err));
    }
  }

  // Selected rows (or all shown rows) in one print job
  const selectedRows = filtered.filter((r) => selected.has(r.id));
  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(selectedRows.length === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)));
  }
  async function printMany(list: PrintRow[]) {
    if (!list.length) return;
    setBulk({ done: 0, total: list.length });
    try {
      const { printed, failed } = await printOrderLabels(
        list.map((r) => r.shopify_order_id),
        (done, total) => setBulk({ done, total }),
      );
      const ok = new Set(printed);
      if (tab === "pending") setRows((prev) => prev.filter((r) => !ok.has(r.shopify_order_id)));
      setSelected(new Set(list.filter((r) => !ok.has(r.shopify_order_id)).map((r) => r.id)));
      if (printed.length) success("تمت الطباعة", `${printed.length} بوليصة — اتنقلوا لـ Printed على J&T`);
      if (failed.length) {
        const nums = failed.slice(0, 3).map((f) => list.find((r) => r.shopify_order_id === f.id)?.order_number).join("، ");
        error(`فشل ${failed.length} بوليصة`, `${nums}${failed.length > 3 ? " ..." : ""} — ${failed[0].error.slice(0, 120)}`);
      }
    } finally {
      setBulk(null);
    }
  }

  async function printLabel(row: PrintRow) {
    setPrintingId(row.shopify_order_id);
    try {
      await printOrderLabel(row.shopify_order_id);
      if (tab === "pending") setRows((prev) => prev.filter((r) => r.id !== row.id));
      success("تمت الطباعة", `${row.order_number} — اتنقل لـ Printed على J&T`);
    } catch (err) {
      error("فشل الطباعة", err instanceof Error ? err.message : String(err));
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">الطباعة</h1>
          <p className="text-small mt-0.5">
            الطلبات المشحونة على J&T — بعد طباعة البوليصة الطلب بيتنقل لـ Printed عند J&T
          </p>
        </div>
        <Button variant="secondary" size="sm"
          icon={loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={14} />}
          onClick={() => reload(tab)} disabled={loading}>
          تحديث
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {([["pending", "لم تُطبع"], ["printed", "تمت طباعتها"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => { if (key !== tab) { setTab(key); setRows([]); reload(key); } }}
            className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold transition-all ${
              tab === key ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}>
            {label}{tab === key && !loading ? ` (${rows.length})` : ""}
          </button>
        ))}
        {filtered.length > 0 && (
          <Button size="sm" variant="primary" disabled={bulk !== null || printingId !== null}
            icon={bulk ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
            onClick={() => printMany(selectedRows.length ? selectedRows : filtered)}>
            {bulk
              ? `جارٍ جلب البوالص ${bulk.done} / ${bulk.total}`
              : selectedRows.length
                ? `طباعة المحدد (${selectedRows.length})`
                : `طباعة الكل (${filtered.length})`}
          </Button>
        )}
        <div className="relative mr-auto w-full sm:w-64">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="form-input pr-9" placeholder="رقم الطلب / التتبع / العميل" />
        </div>
      </div>

      {/* Day + product filters — "طباعة الكل" prints exactly what's shown */}
      <div className="card p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarDays size={15} className="text-[var(--text-muted)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)]">اليوم:</span>
          <button onClick={() => setDay("")}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${!day ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
            كل الأيام
          </button>
          {days.slice(0, 8).map(([d, n]) => (
            <button key={d} onClick={() => setDay(day === d ? "" : d)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${day === d ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
              {dayLabel(d)} ({n})
            </button>
          ))}
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
            className="form-input w-auto py-1 text-xs" title="اختار يوم من الكالندر" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Package size={15} className="text-[var(--text-muted)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)]">المنتج (SKU):</span>
          <div className="relative w-full sm:w-72">
            <input value={sku} onChange={(e) => setSku(e.target.value)} list="print-skus"
              className="form-input py-1 text-xs pl-8" placeholder="اكتب أو اختار الكود — مثلاً NK2" dir="ltr" />
            {sku && (
              <button onClick={() => setSku("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--danger)]" title="مسح">
                <X size={13} />
              </button>
            )}
            <datalist id="print-skus">
              {skus.map(([k, v]) => <option key={k} value={k}>{v.label} ({v.pieces} قطعة)</option>)}
            </datalist>
          </div>
          {skuQuery && (
            <span className="text-xs text-[var(--text-secondary)]">
              {filtered.length} طلب — {skuPieces} قطعة {skuExact ? "" : "(بحث جزئي)"}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-16">
            <Loader2 size={22} className="animate-spin text-[var(--primary)]" />
            <p className="text-sm text-[var(--text-muted)]">جارٍ التحميل...</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={tab === "pending" ? <CheckCircle2 size={28} /> : <Printer size={28} />}
            title={rows.length && (day || sku) ? "مفيش طلبات بالفلتر ده" : tab === "pending" ? "مفيش بوالص مستنية طباعة" : "لا توجد بوالص مطبوعة"}
            description={tab === "pending" ? "أي طلب يتشحن على J&T هيظهر هنا لحد ما تطبعي البوليصة" : ""}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10 text-center">
                    <input type="checkbox" className="rounded" disabled={bulk !== null}
                      checked={filtered.length > 0 && selectedRows.length === filtered.length}
                      onChange={toggleAll} />
                  </th>
                  <th>رقم الطلب</th>
                  <th>العميل</th>
                  <th>الهاتف</th>
                  <th>المنتجات</th>
                  <th>رقم التتبع</th>
                  <th>تاريخ الشحن</th>
                  <th className="text-center">البوليصة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={selected.has(r.id) ? "bg-(--primary-light)" : ""}>
                    <td className="text-center">
                      <input type="checkbox" className="rounded" disabled={bulk !== null}
                        checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    </td>
                    <td>
                      <Link href={`/dashboard/orders/${r.shopify_order_id}`}
                        className="text-xs font-bold text-[var(--primary)] hover:underline">
                        {r.order_number}
                      </Link>
                    </td>
                    <td className="text-xs">{r.customer_name ?? "—"}</td>
                    <td className="text-xs" dir="ltr">{r.phone ?? "—"}</td>
                    <td className="text-[11px] whitespace-nowrap" dir="ltr">
                      {r.items.length
                        ? r.items.map((i) => `${i.sku || i.name} ×${i.qty}`).join("، ")
                        : <span className="text-[var(--text-muted)]">—</span>}
                    </td>
                    <td><span className="font-mono text-xs font-semibold">{r.tracking_number}</span></td>
                    <td><span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">{formatDate(r.created_at)}</span></td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                      {tab === "printed" && (
                        <Button size="sm" variant="secondary" icon={<Eye size={13} />}
                          disabled={printingId !== null}
                          onClick={() => previewLabel(r)}>
                          معاينة
                        </Button>
                      )}
                      <Button size="sm" variant={tab === "pending" ? "primary" : "secondary"}
                        icon={printingId === r.shopify_order_id ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                        disabled={printingId !== null}
                        onClick={() => printLabel(r)}>
                        {tab === "pending" ? "طباعة البوليصة" : "إعادة طباعة"}
                      </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
