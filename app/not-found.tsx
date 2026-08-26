import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
      <div className="text-center px-6">
        <div className="text-8xl font-black text-[var(--border-color)] mb-4">404</div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          الصفحة غير موجودة
        </h1>
        <p className="text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
          عذراً، لم يتم العثور على الصفحة التي تبحث عنها
        </p>
        <Link
          href="/dashboard"
          className="btn btn-primary inline-flex"
        >
          العودة للوحة التحكم
        </Link>
      </div>
    </div>
  );
}
