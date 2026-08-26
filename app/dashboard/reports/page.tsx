"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  mockReportSummary,
  salesDataThisMonth,
  salesDataLastWeek,
  salesDataLast3Months,
} from "@/lib/mock/reports";

type Period = "week" | "month" | "3months";

const periodLabels: Record<Period, string> = {
  week: "آخر 7 أيام",
  month: "هذا الشهر",
  "3months": "آخر 3 أشهر",
};

const periodData: Record<Period, typeof salesDataThisMonth> = {
  week: salesDataLastWeek,
  month: salesDataThisMonth,
  "3months": salesDataLast3Months,
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  processing: "قيد التجهيز",
  sent_to_shipping: "تم الإرسال للشحن",
  in_delivery: "قيد التوصيل",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
  returned: "مرتجع",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  new: "#0284c7",
  processing: "#ea580c",
  sent_to_shipping: "#2563eb",
  in_delivery: "#d97706",
  delivered: "#16a34a",
  cancelled: "#dc2626",
  returned: "#6b7280",
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[var(--border-color)] rounded-[var(--radius-md)] shadow-[var(--shadow-md)] p-3 text-right">
      <p className="text-xs font-medium text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold text-[var(--text-primary)]">
          {p.name === "sales" ? `${p.value.toLocaleString("ar-EG")} ج.م` : `${p.value} طلب`}
        </p>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const data = periodData[period];
  const summary = mockReportSummary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">التقارير</h1>
          <p className="text-small mt-0.5">تحليل شامل لأداء المتجر</p>
        </div>
        <div className="flex items-center bg-[var(--bg-base)] rounded-[var(--radius-md)] p-1 gap-1">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-all ${
                period === p
                  ? "bg-white text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="إجمالي المبيعات"
          value={`${summary.totalSales.toLocaleString("ar-EG")} ج.م`}
          color="var(--primary)"
        />
        <SummaryCard
          title="إجمالي الطلبات"
          value={summary.totalOrders.toLocaleString("ar-EG")}
          color="var(--info)"
        />
        <SummaryCard
          title="متوسط قيمة الطلب"
          value={`${summary.averageOrderValue.toLocaleString("ar-EG")} ج.م`}
          color="var(--purple)"
        />
        <SummaryCard
          title="العملاء الجدد"
          value={summary.newCustomers.toLocaleString("ar-EG")}
          color="var(--success)"
        />
      </div>

      {/* Sales Chart */}
      <Card>
        <CardHeader title="المبيعات" subtitle="إجمالي الإيرادات خلال الفترة المحددة" />
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              axisLine={false}
              tickLine={false}
              orientation="right"
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="sales" fill="var(--primary)" radius={[4, 4, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Orders & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Chart */}
        <Card>
          <CardHeader title="الطلبات" subtitle="عدد الطلبات خلال الفترة" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} orientation="right" width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="orders" stroke="var(--success)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Order Status Distribution */}
        <Card>
          <CardHeader title="توزيع حالات الطلبات" />
          <div className="space-y-3">
            {summary.orderStatusCounts.map((item) => {
              const total = summary.orderStatusCounts.reduce((s, i) => s + i.count, 0);
              const pct = Math.round((item.count / total) * 100);
              return (
                <div key={item.status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[var(--text-secondary)]">
                      {ORDER_STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)]">{pct}%</span>
                      <span className="text-xs font-bold text-[var(--text-primary)]">{item.count}</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: ORDER_STATUS_COLORS[item.status] ?? "var(--neutral)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader title="أكثر المنتجات مبيعاً" subtitle="خلال الفترة المحددة" />
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>المنتج</th>
                <th>SKU</th>
                <th>التصنيف</th>
                <th>الوحدات المباعة</th>
                <th>الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {summary.topProducts.map((p, idx) => (
                <tr key={p.productId}>
                  <td>
                    <span className={`text-xs font-bold ${idx === 0 ? "text-[var(--warning)]" : idx === 1 ? "text-[var(--neutral)]" : idx === 2 ? "text-[var(--orange)]" : "text-[var(--text-muted)]"}`}>
                      #{idx + 1}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs font-medium text-[var(--text-primary)]">{p.productName}</span>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-[var(--text-muted)]">{p.sku}</span>
                  </td>
                  <td>
                    <Badge variant="neutral" size="sm">{p.category}</Badge>
                  </td>
                  <td>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{p.totalSales}</span>
                  </td>
                  <td>
                    <span className="text-xs font-bold text-[var(--primary)]">
                      {p.totalRevenue.toLocaleString("ar-EG")} ج.م
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delivery Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="sm">
          <p className="text-xs text-[var(--text-muted)] mb-1">تم التوصيل</p>
          <p className="text-xl font-bold text-[var(--success)]">{summary.deliveredOrders}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {Math.round((summary.deliveredOrders / summary.totalOrders) * 100)}% من الإجمالي
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-[var(--text-muted)] mb-1">ملغي</p>
          <p className="text-xl font-bold text-[var(--danger)]">{summary.cancelledOrders}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {Math.round((summary.cancelledOrders / summary.totalOrders) * 100)}% من الإجمالي
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-[var(--text-muted)] mb-1">مرتجع</p>
          <p className="text-xl font-bold text-[var(--neutral)]">{summary.returnedOrders}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {Math.round((summary.returnedOrders / summary.totalOrders) * 100)}% من الإجمالي
          </p>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-[var(--text-muted)] mb-2">{title}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
