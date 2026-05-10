import * as React from "react"
import { cn } from "@/lib/utils"

type Variant = "default" | "outline" | "accent" | "danger" | "success"

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  const variants: Record<Variant, string> = {
    default: "bg-[var(--color-surface-2)] text-[var(--color-fg-soft)] border-[var(--color-border)]",
    outline: "bg-transparent text-[var(--color-fg-soft)] border-[var(--color-border)]",
    accent:
      "border-transparent text-black bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-2))]",
    danger: "bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/40",
    success: "bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/40",
  }
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
