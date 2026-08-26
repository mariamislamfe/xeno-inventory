"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { mockReportSummary } from "@/lib/mock/reports";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  processing: "قيد التجهيز",
  sent_to_shipping: "تم الإرسال للشحن",
  in_delivery: "قيد التوصيل",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
  returned: "مرتجع",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#0284c7",
  processing: "#ea580c",
  sent_to_shipping: "#2563eb",
  in_delivery: "#d97706",
  delivered: "#16a34a",
  cancelled: "#dc2626",
  returned: "#6b7280",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { status: string } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[var(--radius-md)] shadow-[var(--shadow-md)] p-3 text-right">
      <p className="text-xs font-semibold text-[var(--text-primary)]">
        {STATUS_LABELS[payload[0].payload.status] ?? payload[0].name}
      </p>
      <p className="text-sm font-bold text-[var(--text-secondary)]">
        {payload[0].value} طلب
      </p>
    </div>
  );
}

export function OrdersChart() {
  const data = mockReportSummary.orderStatusCounts.map((s) => ({
    ...s,
    name: STATUS_LABELS[s.status] ?? s.status,
    fill: STATUS_COLORS[s.status] ?? "#6b7280",
  }));

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-section-title">توزيع الطلبات</h2>
        <p className="text-small mt-0.5">حسب الحالة لهذا الشهر</p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="count"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.fill} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {data.map((item) => (
          <div key={item.status} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: item.fill }}
            />
            <span className="text-xs text-[var(--text-muted)] truncate">{item.name}</span>
            <span className="text-xs font-semibold text-[var(--text-primary)] mr-auto">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
