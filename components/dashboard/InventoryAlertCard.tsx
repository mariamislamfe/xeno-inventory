"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { InventoryItem } from "@/lib/types";

interface Props {
  title: string;
  items: InventoryItem[];
  colorClass: string;       // e.g. "text-[var(--danger)]"
  badgeBg: string;          // e.g. "bg-[var(--danger-light)]"
  badgeText: string;
  count: number;
  delta: number;
}

const MAX_VISIBLE = 3;

export function InventoryAlertCard({
  title, items, colorClass, badgeBg, badgeText, count, delta,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, MAX_VISIBLE);
  const hasMore = items.length > MAX_VISIBLE;

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-[var(--text-muted)]">{title}</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg} ${badgeText}`}>
          ↗ {delta}
        </span>
      </div>

      {/* Big count */}
      <p className={`text-stat-md leading-none ${colorClass}`} dir="ltr">
        {count.toLocaleString("en-US")}
      </p>

      {/* Product list */}
      {items.length > 0 && (
        <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
          {visible.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--text-secondary)] truncate flex-1">
                {item.productName}
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">
                {item.sku}
              </span>
              <span className={`text-[10px] font-bold flex-shrink-0 ${colorClass}`}>
                {item.currentStock}
              </span>
            </div>
          ))}

          {hasMore && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-[11px] text-[var(--primary)] font-medium hover:underline w-full text-right pt-0.5"
            >
              وأخرى ({items.length - MAX_VISIBLE}) — عرض المزيد
            </button>
          )}
          {expanded && (
            <Link
              href="/dashboard/inventory"
              className="text-[11px] text-[var(--primary)] font-medium hover:underline block text-right pt-0.5"
            >
              عرض الكل في صفحة المخزون
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
