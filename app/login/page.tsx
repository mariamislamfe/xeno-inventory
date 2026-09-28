"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2, Eye, EyeOff, Mail, User } from "lucide-react";

type Mode = "login" | "register";

function LoginForm() {
  const [mode,     setMode]     = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get("from") ?? "/dashboard";

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (mode === "register" && !fullName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "/api/auth" : "/api/auth/register";
      const body     = mode === "login"
        ? { email, password }
        : { email, password, fullName: fullName.trim() };

      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشلت العملية");
      router.replace(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشلت العملية");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = mode === "login"
    ? email && password
    : email && password.length >= 6 && fullName.trim();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-sm">
        <div className="card p-8 space-y-6">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-[var(--primary)] flex items-center justify-center mx-auto">
              <Lock size={22} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">XENO</h1>
            <p className="text-xs text-[var(--text-muted)]">نظام إدارة المخزون والطلبات — شركة زينو</p>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-[var(--radius-md)] bg-[var(--bg-base)] p-1 gap-1">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-[var(--radius-sm)] transition-all ${
                mode === "login"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              دخول
            </button>
            <button
              onClick={() => switchMode("register")}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-[var(--radius-sm)] transition-all ${
                mode === "register"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              إنشاء حساب
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name — register only */}
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  الاسم الكامل
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="form-input w-full pl-9"
                    placeholder="مثال: أحمد محمد"
                    autoFocus
                    autoComplete="name"
                  />
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input w-full pl-9"
                  placeholder="example@zeno.com"
                  autoFocus={mode === "login"}
                  autoComplete="email"
                  dir="ltr"
                />
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                كلمة المرور
                {mode === "register" && (
                  <span className="text-[var(--text-muted)] font-normal mr-1">(6 أحرف على الأقل)</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input w-full pl-9"
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--primary)]"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-[var(--danger)] bg-[var(--danger-light)] border border-[var(--danger-border)] rounded-[var(--radius-md)] px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] text-white text-sm font-semibold px-4 py-2.5 rounded-[var(--radius-md)] hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              {mode === "login" ? "دخول" : "إنشاء الحساب والدخول"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
