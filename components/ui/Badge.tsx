"use client";

import React from "react";

type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple"
  | "orange"
  | "primary";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-[var(--success-light)] text-[var(--success-text)] border border-[var(--success-border)]",
  warning: "bg-[var(--warning-light)] text-[var(--warning-text)] border border-[var(--warning-border)]",
  danger: "bg-[var(--danger-light)] text-[var(--danger-text)] border border-[var(--danger-border)]",
  info: "bg-[var(--info-light)] text-[var(--info-text)] border border-[var(--info-border)]",
  neutral: "bg-[var(--neutral-light)] text-[var(--neutral-text)] border border-[var(--neutral-border)]",
  purple: "bg-[var(--purple-light)] text-[var(--purple-text)] border border-[var(--purple-border)]",
  orange: "bg-[var(--orange-light)] text-[var(--orange-text)] border border-[var(--orange-border)]",
  primary: "bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary-muted)]",
};

const dotColors: Record<BadgeVariant, string> = {
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  info: "bg-[var(--info)]",
  neutral: "bg-[var(--neutral)]",
  purple: "bg-[var(--purple)]",
  orange: "bg-[var(--orange)]",
  primary: "bg-[var(--primary)]",
};

export function Badge({
  variant = "neutral",
  children,
  size = "md",
  dot = false,
  className = "",
}: BadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${sizeClass} ${variantStyles[variant]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
