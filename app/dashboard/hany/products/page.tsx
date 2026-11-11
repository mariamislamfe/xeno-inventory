"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, Loader2, RefreshCw, ExternalLink, Eye, EyeOff, Minus, Plus, Check, ChevronDown, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import type { HanyPagination, HanyProduct, HanyVariant } from "@/lib/hany/types";

type StatusFilter = "all" | "published" | "draft" | "archived";
const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all",       label: "الكل" },
  { key: "published", label: "منشور" },
  { key: "draft",     label: "مخفي" },
  { key: "archived",  label: "مؤرشف" },
];

async function send(url: string, method: string, body: unknown) {
  const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error ?? "فشل التحديث");
  return data;
}

function variantLabel(p: HanyProduct, v: HanyVariant) {
  return `${p.name} ${[v.color, v.size].filter(Boolean).join("/")}`.trim();
}

// ── One variant's stock: −1 / +1 (relative, safe while orders come in) or set a number ──
function StockCell({ product, variant, onChange }: { product: HanyProduct; variant: HanyVariant; onChange: (stock: number) => void }) {
  const [busy, setBusy]   = useState(false);
  const [edit, setEdit]   = useState<string | null>(null);
  const { error } = useToast();

  async function run(body: Record<string, unknown>, next: number) {
    setBusy(true);
    try {
      await send(`/api/hany/variants/${variant.id}/stock`, "PATCH", { ...body, label: variantLabel(product, variant) });
      onChange(next);
      setEdit(null);
    } catch (err) {
      error("خطأ في المخزون", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (edit !== null) {
    const n = Number(edit);
    const ok = edit !== "" && Number.isInteger(n) && n >= 0;
    return (
      <div className="flex items-center gap-1">
        <input autoFocus type="number" min={0} value={edit} onChange={(e) => setEdit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && ok) run({ set: n }, n); if (e.key === "Escape") setEdit(null); }}
          className="form-input w-16 text-center text-xs py-1 px-1" dir="ltr" />
        <button disabled={!ok || busy} onClick={() => run({ set: n }, n)} className="p-1 text-[var(--success)] disabled:opacity-40" title="حفظ">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button disabled={busy || variant.stock <= 0} onClick={() => run({ adjust: -1 }, variant.stock - 1)}
        className="p-1 rounded hover:bg-[var(--bg-base)] text-[var(--text-muted)] disabled:opacity-30" title="نقّص 1">
        <Minus size={12} />
      </button>
      <button onClick={() => setEdit(String(variant.stock))} title="اكتبي الكمية"
        className={`min-w-[34px] text-center text-xs font-bold font-numbers rounded px-1 py-0.5 hover:bg-[var(--bg-base)] ${variant.stock === 0 ? "text-[var(--danger)]" : variant.stock <= 3 ? "text-[var(--warning-text)]" : "text-[var(--text-primary)]"}`}>
        {busy ? <Loader2 size={12} className="inline animate-spin" /> : variant.stock}
      </button>
      <button disabled={busy} onClick={() => run({ adjust: 1 }, variant.stock + 1)}
        className="p-1 rounded hover:bg-[var(--bg-base)] text-[var(--text-muted)] disabled:opacity-30" title="زوّد 1">
        <Plus size={12} />
      </button>
    </div>
  );
}

// ── One product card ──
function ProductCard({ product, onChange }: { product: HanyProduct; onChange: (p: HanyProduct) => void }) {
  const [open,  setOpen]  = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [price, setPrice] = useState<string | null>(null);
  const { success, error } = useToast();
  const total   = product.variants.reduce((s, v) => s + v.stock, 0);
  const empty   = product.variants.filter((v) => v.stock === 0).length;
  const image   = product.images[0]?.url;

  async function patch(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const data = await send(`/api/hany/products/${product.id}`, "PATCH", body);
      onChange(data.product);
      setPrice(null);
      success("تم", done);
    } catch (err) {
      error("خطأ", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const priceOk = price !== null && price !== "" && Number(price) >= 0 && Number.isFinite(Number(price));

  return (
    <div className="card overflow-hidden">
      <div className="flex gap-3 p-3">
        {image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={image} alt="" className="w-20 h-20 rounded-[var(--radius-md)] object-cover bg-[var(--bg-base)] flex-shrink-0" />
          : <div className="w-20 h-20 rounded-[var(--radius-md)] bg-[var(--bg-base)] flex-shrink-0" />}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">{product.name}</p>
            <a href={product.url} target="_blank" rel="noreferrer" className="text-[var(--text-muted)] hover:text-[var(--primary)] flex-shrink-0" title="فتح في المتجر">
              <ExternalLink size={13} />
            </a>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {product.archived
              ? <Badge variant="neutral" size="sm">مؤرشف</Badge>
              : product.is_published ? <Badge variant="success" size="sm">منشور</Badge> : <Badge variant="warning" size="sm">مخفي</Badge>}
            {product.category && <span className="text-[11px] text-[var(--text-muted)]">{product.category.name}</span>}
          </div>
          {price === null ? (
            <button onClick={() => setPrice(String(product.base_price))} className="flex items-center gap-1 text-sm font-bold text-[var(--primary)] hover:underline" title="تعديل السعر">
              <span dir="ltr">{product.base_price.toLocaleString("en-US")} ج.م</span>
              {product.compare_at_price ? <span className="text-[11px] text-[var(--text-muted)] line-through font-normal" dir="ltr">{product.compare_at_price.toLocaleString("en-US")}</span> : null}
              <Pencil size={11} className="opacity-50" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input autoFocus type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && priceOk) patch({ base_price: Number(price) }, "اتغير السعر"); if (e.key === "Escape") setPrice(null); }}
                className="form-input w-24 text-xs py-1" dir="ltr" />
              <button disabled={!priceOk || busy} onClick={() => patch({ base_price: Number(price) }, "اتغير السعر")} className="p-1 text-[var(--success)] disabled:opacity-40">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
            </div>
          )}
          <p className="text-[11px] text-[var(--text-muted)]">
            المخزون: <b className="text-[var(--text-primary)] font-numbers">{total}</b> قطعة
            {empty > 0 && <span className="text-[var(--danger)]"> · {empty} مقاس خلصان</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 pb-3">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => setOpen(!open)}
          icon={<ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />}>
          المقاسات ({product.variants.length})
        </Button>
        {!product.archived && (
          <Button size="sm" variant={product.is_published ? "ghost" : "outline"} loading={busy && price === null}
            icon={product.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
            onClick={() => patch({ is_published: !product.is_published }, product.is_published ? "المنتج اتخفى من الموقع" : "المنتج اتنشر على الموقع")}>
            {product.is_published ? "إخفاء" : "نشر"}
          </Button>
        )}
      </div>

      {open && (
        <div className="border-t border-[var(--border-subtle)] max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {product.variants.map((v) => (
                <tr key={v.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {v.color_hex && <span className="w-3 h-3 rounded-full border border-[var(--border-color)] flex-shrink-0" style={{ background: v.color_hex }} />}
                      <span className="text-[var(--text-primary)]">{[v.color, v.size].filter(Boolean).join(" / ") || "—"}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]" dir="ltr">{v.sku}</span>
                  </td>
                  <td className="px-2 py-1.5 text-[var(--text-muted)] whitespace-nowrap" dir="ltr">{v.price.toLocaleString("en-US")}</td>
                  <td className="px-3 py-1.5">
                    <StockCell product={product} variant={v}
                      onChange={(stock) => onChange({ ...product, variants: product.variants.map((x) => x.id === v.id ? { ...x, stock, is_available: stock > 0 } : x) })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function HanyProductsPage() {
  const [products,   setProducts]   = useState<HanyProduct[]>([]);
  const [pagination, setPagination] = useState<HanyPagination | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [status,     setStatus]     = useState<StatusFilter>("all");
  const [q,          setQ]          = useState("");
  const [qInput,     setQInput]     = useState("");
  const [page,       setPage]       = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const { error } = useToast();

  // Callers set loading first (keeps setState out of the effect body)
  async function load(p = page, st = status, query = q) {
    try {
      const qs   = new URLSearchParams({ status: st, page: String(p) });
      if (query) qs.set("q", query);
      const res  = await fetch(`/api/hany/products?${qs}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "تعذر تحميل المنتجات");
      setConfigured(data.configured !== false);
      setProducts(data.products ?? []);
      setPagination(data.pagination);
      setPage(p);
    } catch (err) {
      error("خطأ", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }
  // Fetch once on mount (state is set after the response arrives)
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { load(1); }, []);

  function reload(p: number, st = status, query = q) {
    setLoading(true);
    load(p, st, query);
  }

  function onSearch(v: string) {
    setQInput(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setQ(v.trim()); reload(1, status, v.trim()); }, 400);
  }

  function onStatus(st: StatusFilter) {
    setStatus(st);
    reload(1, st);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">منتجات HANY</h1>
          <p className="text-small mt-0.5">
            {loading ? "جارٍ التحميل..." : pagination ? `${pagination.total} منتج على موقع HANY` : "موقع HANY"}
            {" · "}منفصلة عن منتجات Shopify
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => reload(page)} disabled={loading}
          icon={loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={14} />}>
          تحديث
        </Button>
      </div>

      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input value={qInput} onChange={(e) => onSearch(e.target.value)} placeholder="بحث باسم المنتج..." className="form-input pl-9" />
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => onStatus(f.key)}
              className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold whitespace-nowrap transition-colors ${status === f.key ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!configured ? (
        <div className="card"><EmptyState title="HANY مش متوصل لسه" description="لازم HANY_API_KEY يتسجل في إعدادات Vercel." /></div>
      ) : loading && products.length === 0 ? (
        <div className="flex items-center justify-center gap-3 p-16">
          <Loader2 size={22} className="animate-spin text-[var(--primary)]" />
          <p className="text-sm text-[var(--text-muted)]">جارٍ تحميل المنتجات من HANY...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="card"><EmptyState title="مفيش منتجات" description="مفيش منتجات بالفلتر ده" /></div>
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start ${loading ? "opacity-60" : ""}`}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onChange={(np) => setProducts((prev) => prev.map((x) => x.id === np.id ? np : x))} />
            ))}
          </div>
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => reload(page - 1)}>السابق</Button>
              <span className="text-xs text-[var(--text-muted)]">صفحة {page} / {pagination.pages}</span>
              <Button variant="secondary" size="sm" disabled={page >= pagination.pages || loading} onClick={() => reload(page + 1)}>التالي</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
