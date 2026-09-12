"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Menu, Bell, Search, ChevronDown, LogOut, User, X, Sun, Moon, Loader2 } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import Link from "next/link";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Notification {
  id: string;
  type: "order" | "shipment" | "inventory" | "system";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const TYPE_DOT: Record<string, string> = {
  order:     "#3b82f6",
  inventory: "#f59e0b",
  shipment:  "#8b5cf6",
  system:    "#6b7280",
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

// Notification Dropdown — reads from activity_log via /api/notifications
function NotificationDropdown() {
  const [open,   setOpen]   = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/notifications");
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch { /* fail silently */ }
    finally  { setLoading(false); }
  }, []);

  // Fetch unread count once on mount
  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // Poll every 30s only while dropdown is open
  useEffect(() => {
    if (!open) return;
    const t = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(t);
  }, [open, fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications?mark_read=all");
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  function handleOpen() {
    setOpen((v) => !v);
    if (!open) fetchNotifs();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)] transition-colors"
        aria-label={`الإشعارات${unread > 0 ? ` - ${unread} جديدة` : ""}`}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-[var(--danger)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-50 animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">الإشعارات</h3>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <span className="text-xs text-[var(--primary)] font-medium">{unread} جديدة</span>
              )}
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
                  قراءة الكل
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifs.length === 0 && (
              <div className="flex items-center justify-center gap-2 p-8 text-xs text-[var(--text-muted)]">
                <Loader2 size={14} className="animate-spin" /> جارٍ التحميل...
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] text-center p-8">لا توجد إشعارات</p>
            )}
            {notifs.map((n) => (
              <div
                key={n.id}
                className={`flex gap-3 px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-base)] transition-colors ${
                  !n.read ? "bg-[var(--primary-light)]" : ""
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: TYPE_DOT[n.type] ?? "#6b7280" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{n.title}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-[var(--primary)] flex-shrink-0 mt-1.5" />}
              </div>
            ))}
          </div>

          <div className="px-4 py-2.5 text-center border-t border-[var(--border-color)]">
            <Link href="/dashboard/orders" onClick={() => setOpen(false)}
              className="text-xs text-[var(--primary)] font-medium hover:underline">
              فتح الطلبات ←
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Search result types ────────────────────────────────────────────────────────
interface SearchOrder    { shopifyId: string; orderNumber: string; customerName: string }
interface SearchProduct  { id: string; name: string; sku?: string }
interface SearchCustomer { shopifyId: string; name: string; phone?: string }
interface SearchResults  { orders: SearchOrder[]; products: SearchProduct[]; customers: SearchCustomer[] }

// Global Search — queries real Shopify/customer APIs with 400ms debounce
function GlobalSearch() {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setResults(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResults(null);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Debounced search against real APIs
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 2) { setResults(null); return; }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [ordRes, prodRes, custRes] = await Promise.allSettled([
          fetch(`/api/shopify/orders?query=${encodeURIComponent(query)}&limit=3`).then(r => r.json()),
          fetch(`/api/shopify/products?q=${encodeURIComponent(query)}&limit=3`).then(r => r.json()),
          fetch(`/api/shopify/customers?query=${encodeURIComponent(query)}&limit=3`).then(r => r.json()),
        ]);

        const orders: SearchOrder[] = ordRes.status === "fulfilled"
          ? (ordRes.value.orders ?? []).slice(0, 3).map((o: { shopifyId?: string; id?: string; orderNumber: string; customerName: string }) => ({
              shopifyId:    String(o.shopifyId ?? o.id ?? ""),
              orderNumber:  o.orderNumber,
              customerName: o.customerName,
            }))
          : [];

        const products: SearchProduct[] = prodRes.status === "fulfilled"
          ? (prodRes.value.products ?? []).slice(0, 3).map((p: { id: string; name: string; sku?: string; variants?: Array<{ sku?: string }> }) => ({
              id:   String(p.id),
              name: p.name,
              sku:  p.sku ?? p.variants?.[0]?.sku ?? "",
            }))
          : [];

        const customers: SearchCustomer[] = custRes.status === "fulfilled"
          ? (custRes.value.customers ?? []).slice(0, 3).map((c: { shopifyId?: string; id?: string; name: string; phone?: string }) => ({
              shopifyId: String(c.shopifyId ?? c.id ?? ""),
              name:      c.name,
              phone:     c.phone ?? "",
            }))
          : [];

        setResults({ orders, products, customers });
      } catch { setResults(null); }
      finally  { setLoading(false); }
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const hasResults = results && (
    results.orders.length > 0 || results.products.length > 0 || results.customers.length > 0
  );

  function close() { setOpen(false); setQuery(""); setResults(null); }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-muted)] bg-[var(--bg-base)] border border-[var(--border-color)] rounded-[var(--radius-md)] hover:border-[var(--primary)] transition-colors min-w-[180px] text-right"
        aria-label="بحث (Ctrl+K)"
      >
        <Search size={14} />
        <span className="text-xs flex-1">بحث في النظام...</span>
        <kbd className="text-[10px] px-1 py-0.5 rounded bg-[var(--border-color)] text-[var(--text-muted)] font-mono">⌘K</kbd>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[360px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-50 animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-color)]">
            {loading
              ? <Loader2 size={14} className="text-[var(--text-muted)] animate-spin flex-shrink-0" />
              : <Search size={14} className="text-[var(--text-muted)] flex-shrink-0" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث في الطلبات والمنتجات والعملاء..."
              className="flex-1 text-sm outline-none bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              aria-label="حقل البحث"
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults(null); }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="مسح البحث">
                <X size={14} />
              </button>
            )}
          </div>

          {hasResults && (
            <div className="max-h-80 overflow-y-auto py-1">
              {results!.orders.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">الطلبات</p>
                  {results!.orders.map((o) => (
                    <Link key={o.shopifyId} href={`/dashboard/orders/${o.shopifyId}`} onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-base)] transition-colors">
                      <span className="text-xs font-mono text-[var(--primary)]">{o.orderNumber}</span>
                      <span className="text-xs text-[var(--text-secondary)]">{o.customerName}</span>
                    </Link>
                  ))}
                </div>
              )}
              {results!.products.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">المنتجات</p>
                  {results!.products.map((p) => (
                    <Link key={p.id} href={`/dashboard/products/${p.id}`} onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-base)] transition-colors">
                      <span className="text-xs text-[var(--text-secondary)]">{p.name}</span>
                      {p.sku && <span className="text-[10px] text-[var(--text-muted)]">{p.sku}</span>}
                    </Link>
                  ))}
                </div>
              )}
              {results!.customers.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">العملاء</p>
                  {results!.customers.map((c) => (
                    <Link key={c.shopifyId} href={`/dashboard/customers/${c.shopifyId}`} onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-base)] transition-colors">
                      <span className="text-xs text-[var(--text-secondary)]">{c.name}</span>
                      {c.phone && <span className="text-[10px] text-[var(--text-muted)]">{c.phone}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {query.length >= 2 && !loading && !hasResults && (
            <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              لا توجد نتائج لـ &quot;{query}&quot;
            </div>
          )}

          {!query && (
            <div className="px-4 py-4 text-xs text-[var(--text-muted)] text-center">
              اكتب للبحث في الطلبات والمنتجات والعملاء
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// User Profile Dropdown
function UserProfile() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-md)] hover:bg-[var(--bg-base)] transition-colors"
        aria-expanded={open}
        aria-label="قائمة المستخدم"
      >
        <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold">
          م
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-xs font-semibold text-[var(--text-primary)] leading-tight">
            محمد الإداري
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">مدير</p>
        </div>
        <ChevronDown size={13} className="text-[var(--text-muted)]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-50 animate-fade-in overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-color)]">
            <p className="text-sm font-semibold text-[var(--text-primary)]">محمد الإداري</p>
            <p className="text-xs text-[var(--text-muted)]">admin@xeno.com</p>
          </div>
          <div className="py-1">
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-base)] transition-colors"
            >
              <User size={14} />
              الملف الشخصي
            </Link>
            <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-light)] transition-colors">
              <LogOut size={14} />
              تسجيل الخروج
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Theme Toggle Button
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)] transition-colors"
      aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}
    >
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}

export function Header({ title, onMenuClick }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-6 bg-[var(--bg-card)] border-b border-[var(--border-color)]"
      style={{ height: "var(--header-height)" }}
    >
      {/* Mobile Menu Button */}
      <button
        className="lg:hidden p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--bg-base)] transition-colors"
        onClick={onMenuClick}
        aria-label="فتح القائمة"
      >
        <Menu size={18} />
      </button>

      {/* Page Title */}
      <h1 className="text-sm font-bold text-[var(--text-primary)] flex-1 hidden sm:block">
        {title}
      </h1>

      {/* Spacer on mobile */}
      <div className="flex-1 lg:hidden" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Search - hidden on mobile */}
        <div className="hidden md:block">
          <GlobalSearch />
        </div>

        <ThemeToggle />
        <NotificationDropdown />
        <UserProfile />
      </div>
    </header>
  );
}
