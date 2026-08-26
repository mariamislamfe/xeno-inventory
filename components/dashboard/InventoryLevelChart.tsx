"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ProductLevel {
  name: string;
  sku: string;
  stock: number;
  minStock: number;
}

interface Props {
  data: ProductLevel[];
}

function shortName(name: string): string {
  // Keep SKU as the X-axis label for brevity
  return name.length > 12 ? name.slice(0, 12) + "…" : name;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload as ProductLevel;
  return (
    <div
      className="rounded-[var(--radius-md)] border border-[var(--border-color)] p-3 text-right"
      style={{ background: "var(--bg-card)", minWidth: 180, direction: "rtl" }}
    >
      <p className="text-xs font-bold text-[var(--text-primary)] mb-1">{item.name}</p>
      <p className="text-[11px] font-mono text-[var(--text-muted)] mb-2">{item.sku}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-[11px]">
          <span style={{ color: entry.fill }}>
            {entry.dataKey === "stock" ? "المخزون الحالي" : "الحد الأدنى"}
          </span>
          <span className="font-bold font-numbers" style={{ color: entry.fill }}>
            {(entry.value as number).toLocaleString("en-US")}
          </span>
        </div>
      ))}
    </div>
  );
};

export function InventoryLevelChart({ data }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-section-title">مستويات مخزون المنتجات</h2>
          <p className="text-small mt-0.5">
            {data.length} منتج — المخزون الحالي مقابل الحد الأدنى
          </p>
        </div>
      </div>

      <div style={{ direction: "ltr" }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: 0, bottom: 24 }}
            barCategoryGap="25%"
            barGap={3}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle)"
              vertical={false}
            />
            <XAxis
              dataKey="sku"
              tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "inherit" }}
              axisLine={false}
              tickLine={false}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={48}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "inherit" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.toLocaleString("en-US")}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(val) =>
                val === "stock" ? "المخزون الحالي" : "الحد الأدنى"
              }
              wrapperStyle={{
                fontSize: 11,
                fontFamily: "inherit",
                direction: "rtl",
                paddingTop: 8,
              }}
            />
            <Bar dataKey="stock" radius={[4, 4, 0, 0]} name="stock">
              {data.map((entry) => (
                <Cell
                  key={entry.sku}
                  fill={
                    entry.stock === 0       ? "#dc2626"
                    : entry.stock <= entry.minStock ? "#f59e0b"
                    : "#2563eb"
                  }
                />
              ))}
            </Bar>
            <Bar
              dataKey="minStock"
              fill="rgba(100,116,139,0.3)"
              radius={[4, 4, 0, 0]}
              name="minStock"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend for colors */}
      <div className="flex items-center gap-4 mt-2 justify-end text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#2563eb] inline-block" />
          متوفر
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] inline-block" />
          منخفض
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#dc2626] inline-block" />
          نفد
        </span>
      </div>
    </div>
  );
}
