"use client";

import React, { useState } from "react";
import { Sidebar, MobileSidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "لوحة التحكم",
  "/dashboard/orders": "الطلبات",
  "/dashboard/customers": "العملاء",
  "/dashboard/products": "المنتجات",
  "/dashboard/inventory": "المخزون",
  "/dashboard/shipments": "الشحنات",
  "/dashboard/reports": "التقارير",
  "/dashboard/users": "المستخدمون",
  "/dashboard/settings": "الإعدادات",
};

const PATH_TITLE_MATCHERS = [
  { pattern: /^\/dashboard\/orders\/[^/]+$/, title: "تفاصيل الطلب" },
  { pattern: /^\/dashboard\/products\/[^/]+$/, title: "تفاصيل المنتج" },
  { pattern: /^\/dashboard\/customers\/[^/]+$/, title: "تفاصيل العميل" },
  { pattern: /^\/dashboard\/shipments\/[^/]+$/, title: "تفاصيل الشحنة" },
];

function getPageTitle(pathname: string): string {
  const match = PATH_TITLE_MATCHERS.find((m) => pathname.match(m.pattern));
  if (match) return match.title;
  return PAGE_TITLES[pathname] ?? "لوحة التحكم";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <ThemeProvider>
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Sidebar */}
        <MobileSidebar
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header
            title={title}
            onMenuClick={() => setMobileMenuOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="animate-fade-in">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
    </ThemeProvider>
  );
}
