"use client";

import React, { useState } from "react";
import { ScanLine, Plus, Minus } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

type TransactionType = "in" | "out";

export function QuickTransaction() {
  const [type, setType] = useState<TransactionType>("in");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  function handleSubmit() {
    if (!sku.trim()) {
      error("خطأ", "برجاء إدخال رمز المنتج (SKU)");
      return;
    }
    if (quantity < 1) {
      error("خطأ", "الكمية يجب أن تكون 1 على الأقل");
      return;
    }

    setLoading(true);
    // Future: POST /api/inventory/transaction { type, sku, quantity }
    setTimeout(() => {
      setLoading(false);
      const label = type === "in" ? "وارد" : "صادر";
      success(
        "تم تسجيل المعاملة",
        `${label} — ${quantity} وحدة — SKU: ${sku.toUpperCase()}`
      );
      setSku("");
      setQuantity(1);
    }, 600);
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
        معاملة سريعة
      </p>

      {/* Type Toggle */}
      <div className="flex rounded-[var(--radius-md)] border border-[var(--border-color)] overflow-hidden bg-[var(--bg-base)] p-0.5 gap-0.5">
        <button
          onClick={() => setType("in")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${
            type === "in"
              ? "bg-[var(--success)] text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          وارد
        </button>
        <button
          onClick={() => setType("out")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${
            type === "out"
              ? "bg-[var(--danger)] text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          صادر
        </button>
      </div>

      {/* SKU Input */}
      <div className="relative">
        <input
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value.toUpperCase())}
          placeholder="رمز المنتج — SKU"
          className="form-input pl-9 font-mono text-xs"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <ScanLine
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="w-8 h-8 rounded-[var(--radius-md)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-base)] transition-colors flex-shrink-0"
        >
          <Minus size={13} />
        </button>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="form-input text-center text-sm font-semibold"
        />
        <button
          onClick={() => setQuantity((q) => q + 1)}
          className="w-8 h-8 rounded-[var(--radius-md)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-base)] transition-colors flex-shrink-0"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full py-2 rounded-[var(--radius-md)] text-xs font-semibold text-white transition-all disabled:opacity-60 ${
          type === "in"
            ? "bg-[var(--success)] hover:opacity-90"
            : "bg-[var(--danger)] hover:opacity-90"
        }`}
      >
        {loading ? "جاري التسجيل..." : type === "in" ? "إضافة للمخزون" : "تفريغ من المخزون"}
      </button>
    </div>
  );
}
