"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Archive,
  Truck,
  BarChart2,
  UserCog,
  Settings,
  X,
  ArrowLeftRight,
  ClipboardList,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "لوحة التحكم", icon: <LayoutDashboard size={17} /> },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/dashboard/orders",    label: "الطلبات",  icon: <ShoppingCart size={17} /> },
      { href: "/dashboard/customers", label: "العملاء",  icon: <Users size={17} /> },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/dashboard/products",     label: "المنتجات",   icon: <Package size={17} /> },
      { href: "/dashboard/inventory",    label: "المخزون",    icon: <Archive size={17} /> },
      { href: "/dashboard/transactions", label: "المعاملات",  icon: <ArrowLeftRight size={17} /> },
    ],
  },
  {
    label: "Logistics",
    items: [
      { href: "/dashboard/shipments", label: "الشحنات",  icon: <Truck size={17} /> },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/dashboard/reports",   label: "التقارير", icon: <BarChart2 size={17} /> },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/users",    label: "المستخدمون", icon: <UserCog size={17} /> },
      { href: "/dashboard/activity", label: "سجل النشاط", icon: <ClipboardList size={17} /> },
      { href: "/dashboard/settings", label: "الإعدادات",  icon: <Settings size={17} /> },
    ],
  },
];

interface SidebarContentProps {
  pathname: string;
  onClose?: () => void;
}

function SidebarContent({ pathname, onClose }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-sidebar)" }}>

      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--primary)" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5"/>
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5"/>
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.9"/>
            </svg>
          </div>
          <div>
            <p
              className="font-black leading-none tracking-[0.12em]"
              style={{ fontFamily: "var(--font-numbers)", fontSize: "1.125rem", color: "#ffffff" }}
            >
              XENO
            </p>
            <p className="text-[10px] mt-0.5 font-medium tracking-wider uppercase"
               style={{ color: "var(--text-sidebar)", fontFamily: "var(--font-numbers)" }}>
              Inventory OS
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: "var(--text-sidebar)" }}
            aria-label="إغلاق القائمة"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="التنقل الرئيسي">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="sidebar-nav-group-label">{group.label}</p>
            {group.items.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="flex-shrink-0 opacity-80">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5 space-y-1">
        <p
          className="text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: "var(--text-sidebar)", fontFamily: "var(--font-numbers)" }}
        >
          v1.0 · Phase 1
        </p>
        <p
          className="text-[10px]"
          style={{ color: "var(--text-sidebar)", fontFamily: "var(--font-numbers)", opacity: 0.5 }}
        >
          Made by{" "}
          <span className="font-bold" style={{ color: "var(--primary)" }}>
            Websity
          </span>
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="hidden lg:flex flex-col flex-shrink-0 h-screen sticky top-0"
      style={{ width: "var(--sidebar-width)" }}
      aria-label="الشريط الجانبي"
    >
      <SidebarContent pathname={pathname} />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="absolute top-0 right-0 h-full flex flex-col animate-slide-in-top"
        style={{ width: "var(--sidebar-width)" }}
      >
        <SidebarContent pathname={pathname} onClose={onClose} />
      </div>
    </div>
  );
}
