import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    positive: boolean;
    label?: string;
  };
  iconBg?: string;
  iconColor?: string;
  subtitle?: string;
}

export function StatsCard({
  title,
  value,
  trend,
  subtitle,
}: StatsCardProps) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      {/* Label */}
      <p className="text-xs font-semibold text-[var(--text-muted)] leading-tight">
        {title}
        {subtitle && (
          <span className="block text-[10px] mt-0.5 opacity-70">{subtitle}</span>
        )}
      </p>

      {/* Big number */}
      <p className="text-stat leading-none" dir="ltr">{value}</p>

      {/* Delta */}
      {trend && (
        <div className="flex items-center gap-1.5">
          {trend.positive
            ? <TrendingUp size={12} className="text-[var(--success)]" />
            : <TrendingDown size={12} className="text-[var(--danger)]" />
          }
          <span
            className={`text-xs font-bold font-numbers ${
              trend.positive ? "text-[var(--success)]" : "text-[var(--danger)]"
            }`}
          >
            {trend.value}
          </span>
          {trend.label && (
            <span className="text-[11px] text-[var(--text-muted)]">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
