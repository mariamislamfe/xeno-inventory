"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--danger-light)] flex items-center justify-center">
        <AlertTriangle size={22} className="text-[var(--danger)]" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-1">حدث خطأ في تحميل الصفحة</h2>
        <p className="text-xs text-[var(--text-muted)] max-w-xs">
          {error.message?.includes("SHOPIFY") || error.message?.includes("fetch")
            ? "تعذّر الاتصال بـ Shopify. تحقق من إعدادات الـ API."
            : "خطأ غير متوقع. حاول مجدداً أو تواصل مع الدعم."}
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[var(--primary)] text-white rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
      >
        <RefreshCw size={13} />
        إعادة المحاولة
      </button>
    </div>
  );
}
