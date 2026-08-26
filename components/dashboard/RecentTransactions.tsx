import React from "react";
import type { InventoryTransaction } from "@/lib/types";

interface Props {
  transactions: InventoryTransaction[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return "منذ أقل من ساعة";
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${d} يوم`;
}

export function RecentTransactions({ transactions }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-section-title">أحدث المعاملات</h2>
      </div>

      <div className="space-y-2">
        {transactions.map((txn) => (
          <div
            key={txn.id}
            className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--bg-base)] hover:bg-[var(--border-subtle)] transition-colors"
          >
            {/* Type badge */}
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${
                txn.type === "in" ? "bg-[var(--success)]" : "bg-[var(--danger)]"
              }`}
            >
              {txn.type === "in" ? "+" : "−"}
            </span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                {txn.productName}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">{txn.sku}</p>
            </div>

            {/* Quantity */}
            <span
              className={`text-xs font-bold font-numbers flex-shrink-0 ${
                txn.type === "in" ? "text-[var(--success)]" : "text-[var(--danger)]"
              }`}
            >
              {txn.type === "in" ? "+" : "−"}{txn.quantity}
            </span>

            {/* Time */}
            <span className="text-[11px] text-[var(--text-muted)] flex-shrink-0 hidden sm:block">
              {timeAgo(txn.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
