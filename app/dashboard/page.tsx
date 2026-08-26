import React from "react";
import { Card } from "@/components/ui/Card";
import { InventoryLevelChart } from "@/components/dashboard/InventoryLevelChart";
import { InventoryAlertCard } from "@/components/dashboard/InventoryAlertCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { QuickTransaction } from "@/components/dashboard/QuickTransaction";
import { mockNotifications } from "@/lib/mock/notifications";
import {
  getInventoryStats,
  getOutOfStockItems,
  getLowStockItems,
  getProductStockLevels,
  getRecentTransactions,
} from "@/lib/services/inventory";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} K`;
  return n.toLocaleString("en-US");
}

function fmtDelta(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} K`;
  return `${n}`;
}

export default async function DashboardPage() {
  const [stats, outOfStock, lowStock, productLevels, transactions] = await Promise.all([
    getInventoryStats(),
    getOutOfStockItems(),
    getLowStockItems(),
    getProductStockLevels(),
    getRecentTransactions(5),
  ]);

  const recentNotifications = mockNotifications.slice(0, 4);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-page-title">لوحة التحكم</h1>
        <p className="text-small mt-0.5">نظرة عامة على المخزون</p>
      </div>

      {/* ── Row 1: 3 KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold text-[var(--text-muted)]">إجمالي قيمة المخزون</p>
          <p className="text-stat leading-none" dir="ltr">{fmt(stats.totalValue)}</p>
          <span className="text-xs font-bold text-[var(--warning)] font-numbers" dir="ltr">
            ↘ {fmtDelta(stats.totalValueDelta)} EGP
          </span>
        </div>

        <div className="card p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold text-[var(--text-muted)]">إجمالي تكلفة المخزون</p>
          <p className="text-stat leading-none" dir="ltr">{fmt(stats.totalCost)}</p>
          <span className="text-xs font-bold text-[var(--warning)] font-numbers" dir="ltr">
            ↘ {fmtDelta(stats.totalCostDelta)} EGP
          </span>
        </div>

        <div className="card p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold text-[var(--text-muted)]">إجمالي الأصناف</p>
          <p className="text-stat leading-none" dir="ltr">
            {stats.totalSkus.toLocaleString("en-US")}
          </p>
          <span className="text-xs font-bold text-[var(--success)] font-numbers" dir="ltr">
            ↗ {stats.totalSkusDelta} صنف جديد
          </span>
        </div>
      </div>

      {/* ── Row 2: alert cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InventoryAlertCard
          title="أصناف نفذت"
          items={outOfStock}
          count={stats.outOfStock}
          delta={stats.outOfStockDelta}
          colorClass="text-[var(--danger)]"
          badgeBg="bg-[var(--danger-light)]"
          badgeText="text-[var(--danger-text)]"
        />
        <InventoryAlertCard
          title="العناصر منخفضة المخزون"
          items={lowStock}
          count={stats.lowStock}
          delta={stats.lowStockDelta}
          colorClass="text-[var(--warning)]"
          badgeBg="bg-[var(--warning-light)]"
          badgeText="text-[var(--warning-text)]"
        />
      </div>

      {/* ── Row 3: Bar chart ── */}
      <Card padding="lg">
        <InventoryLevelChart data={productLevels} />
      </Card>

      {/* ── Row 4: Transactions + Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md">
          <RecentTransactions transactions={transactions} />
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-section-title">تنبيهات المخزون</h2>
          </div>
          <div className="space-y-2">
            {mockNotifications
              .filter((n) => n.type === "inventory")
              .map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-2.5 p-3 rounded-[var(--radius-md)] bg-[var(--bg-base)]"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: n.read ? "var(--text-muted)" : "var(--danger)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{n.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* ── Row 5: Quick Transaction + Notifications ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md">
          <QuickTransaction />
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-section-title">أحدث الإشعارات</h2>
          </div>
          <div className="space-y-2">
            {recentNotifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2.5 p-3 rounded-[var(--radius-md)] bg-[var(--bg-base)]"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{
                    background: n.type === "order"    ? "#3b82f6"
                              : n.type === "inventory" ? "#f59e0b"
                              : n.type === "shipment"  ? "#8b5cf6"
                              : "#6b7280",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{n.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{n.message}</p>
                </div>
                {!n.read && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] flex-shrink-0 mt-1.5" />
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
