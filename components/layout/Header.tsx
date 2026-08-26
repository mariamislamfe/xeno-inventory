"use client";

import React, { useState, useRef, useEffect } from "react";
import { Menu, Bell, Search, ChevronDown, LogOut, User, X, Sun, Moon } from "lucide-react";
import { mockNotifications } from "@/lib/mock/notifications";
import { mockOrders } from "@/lib/mock/orders";
import { mockProducts } from "@/lib/mock/products";
import { mockCustomers } from "@/lib/mock/customers";
import { useTheme } from "@/components/providers/ThemeProvider";
import Link from "next/link";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

// Notification Dropdown
function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = mockNotifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const typeDot: Record<string, string> = {
    order:     "#3b82f6",
    inventory: "#f59e0b",
    shipment:  "#8b5cf6",
    system:    "#6b7280",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
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
            {unread > 0 && (
              <span className="text-xs text-[var(--primary)] font-medium">{unread} جديدة</span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {mockNotifications.slice(0, 8).map((notif) => (
              <div
                key={notif.id}
                className={`flex gap-3 px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-base)] transition-colors cursor-pointer ${
                  !notif.read ? "bg-[var(--primary-light)]" : ""
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: typeDot[notif.type] ?? "#6b7280" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    {notif.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-[var(--primary)] flex-shrink-0 mt-1.5" />
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 text-center border-t border-[var(--border-color)]">
            <button className="text-xs text-[var(--primary)] font-medium hover:underline">
              عرض جميع الإشعارات
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Global Search
function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const results = query.length >= 2
    ? {
        orders: mockOrders
          .filter(
            (o) =>
              o.orderNumber.includes(query) ||
              o.customerName.includes(query)
          )
          .slice(0, 3),
        products: mockProducts
          .filter(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              p.sku.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 3),
        customers: mockCustomers
          .filter(
            (c) =>
              c.name.includes(query) ||
              c.phone.includes(query)
          )
          .slice(0, 3),
      }
    : null;

  const hasResults =
    results &&
    (results.orders.length > 0 ||
      results.products.length > 0 ||
      results.customers.length > 0);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-muted)] bg-[var(--bg-base)] border border-[var(--border-color)] rounded-[var(--radius-md)] hover:border-[var(--primary)] transition-colors min-w-[180px] text-right"
        aria-label="بحث"
      >
        <Search size={14} />
        <span className="text-xs">بحث في النظام...</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[360px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-50 animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-color)]">
            <Search size={14} className="text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث في الطلبات والمنتجات والعملاء..."
              className="flex-1 text-sm outline-none bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              aria-label="حقل البحث"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="مسح البحث"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {hasResults && (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.orders.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    الطلبات
                  </p>
                  {results.orders.map((o) => (
                    <Link
                      key={o.id}
                      href={`/dashboard/orders/${o.id}`}
                      onClick={() => { setOpen(false); setQuery(""); }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-base)] transition-colors"
                    >
                      <span className="text-xs font-mono text-[var(--primary)]">
                        {o.orderNumber}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {o.customerName}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {results.products.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    المنتجات
                  </p>
                  {results.products.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/products/${p.id}`}
                      onClick={() => { setOpen(false); setQuery(""); }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-base)] transition-colors"
                    >
                      <span className="text-xs text-[var(--text-secondary)]">{p.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{p.sku}</span>
                    </Link>
                  ))}
                </div>
              )}
              {results.customers.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    العملاء
                  </p>
                  {results.customers.map((c) => (
                    <Link
                      key={c.id}
                      href={`/dashboard/customers/${c.id}`}
                      onClick={() => { setOpen(false); setQuery(""); }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-base)] transition-colors"
                    >
                      <span className="text-xs text-[var(--text-secondary)]">{c.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{c.phone}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {query.length >= 2 && !hasResults && (
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
