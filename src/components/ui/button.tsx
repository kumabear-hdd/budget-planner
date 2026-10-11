import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm" | "icon";

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" && "h-11 px-4 text-sm",
        size === "sm" && "h-11 px-3 text-sm",
        size === "icon" && "size-11",
        variant === "primary" && "bg-primary text-on-primary hover:bg-primary-dark",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "bg-transparent text-ink hover:bg-surface-2",
        variant === "danger" && "bg-expense text-on-primary hover:bg-expense-dark",
        className,
      )}
      {...props}
    />
  );
}
