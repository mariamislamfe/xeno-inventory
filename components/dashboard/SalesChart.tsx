"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  salesDataToday,
  salesDataLastWeek,
  salesDataThisMonth,
  salesDataLast3Months,
} from "@/lib/mock/reports";

type Period = "today" | "week" | "month" | "3months";

const periodData: Record<Period, typeof salesDataToday> = {
  today: salesDataToday,
  week: salesDataLastWeek,
  month: salesDataThisMonth,
  "3months": salesDataLast3Months,
};

const periodLabels: Record<Period, string> = {
  today: "اليوم",
  week: "الأسبوع",
  month: "الشهر",
  "3months": "3 أشهر",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[var(--radius-md)] shadow-[var(--shadow-md)] p-3 text-right min-w-[140px]">
      <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-[var(--text-muted)]">
            {p.dataKey === "sales" ? "المبيعات" : "الطلبات"}
          </span>
          <span className="text-xs font-bold" style={{ color: p.color }}>
            {p.dataKey === "sales"
              ? `${p.value.toLocaleString("en-US")} ج.م`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SalesChart() {
  const [period, setPeriod] = useState<Period>("week");
  const data = periodData[period];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">المبيعات والطلبات</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">مقارنة الإيرادات وعدد الطلبات</p>
        </div>
        <div className="flex items-center bg-[var(--bg-base)] rounded-[var(--radius-md)] p-0.5 gap-0.5">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-all ${
                period === p
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
          barCategoryGap="30%"
          barGap={3}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-color)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="sales"
            orientation="right"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
            }
            width={40}
          />
          <YAxis
            yAxisId="orders"
            orientation="left"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={24}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--border-subtle)", radius: 4 }} />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {value === "sales" ? "المبيعات (ج.م)" : "الطلبات"}
              </span>
            )}
          />
          <Bar
            yAxisId="sales"
            dataKey="sales"
            name="sales"
            fill="#3b82f6"
            radius={[5, 5, 0, 0]}
            maxBarSize={26}
          />
          <Bar
            yAxisId="orders"
            dataKey="orders"
            name="orders"
            fill="#8b5cf6"
            radius={[5, 5, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
