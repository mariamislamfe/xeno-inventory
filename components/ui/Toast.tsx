"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-[var(--success)]" />,
  error: <XCircle size={18} className="text-[var(--danger)]" />,
  info: <Info size={18} className="text-[var(--info)]" />,
  warning: <AlertTriangle size={18} className="text-[var(--warning)]" />,
};

const toastBorders: Record<ToastType, string> = {
  success: "border-r-4 border-r-[var(--success)]",
  error: "border-r-4 border-r-[var(--danger)]",
  info: "border-r-4 border-r-[var(--info)]",
  warning: "border-r-4 border-r-[var(--warning)]",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  return (
    <div
      className={`
        animate-toast-in
        flex items-start gap-3 bg-white rounded-[var(--radius-lg)]
        shadow-[var(--shadow-lg)] p-4 min-w-[300px] max-w-sm
        border border-[var(--border-color)] ${toastBorders[toast.type]}
      `}
      role="alert"
    >
      <span className="flex-shrink-0 mt-0.5">{toastIcons[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="إغلاق"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  const contextValue: ToastContextValue = {
    addToast,
    success: (title, message) => addToast({ type: "success", title, message }),
    error: (title, message) => addToast({ type: "error", title, message }),
    info: (title, message) => addToast({ type: "info", title, message }),
    warning: (title, message) => addToast({ type: "warning", title, message }),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Container */}
      <div
        aria-live="polite"
        className="fixed bottom-6 left-6 z-[100] flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
