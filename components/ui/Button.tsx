"use client";

import React from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "right" | "left";
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--primary)] text-white border border-[var(--primary)] hover:bg-[var(--primary-hover)] hover:border-[var(--primary-hover)]",
  secondary:
    "bg-white text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]",
  danger:
    "bg-[var(--danger)] text-white border border-[var(--danger)] hover:bg-[var(--danger-text)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]",
  outline:
    "bg-transparent text-[var(--primary)] border border-[var(--primary)] hover:bg-[var(--primary-light)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "right",
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-medium rounded-[var(--radius-md)]
        transition-all duration-150 cursor-pointer whitespace-nowrap
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {!loading && icon && iconPosition === "right" && icon}
      {children}
      {!loading && icon && iconPosition === "left" && icon}
    </button>
  );
}
