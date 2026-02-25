import * as React from "react";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline" | "destructive";
};

function badgeClasses(variant: BadgeProps["variant"] = "default") {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

  if (variant === "secondary") {
    return `${base} bg-slate-100 text-slate-800`;
  }
  if (variant === "outline") {
    return `${base} border border-slate-300 text-slate-700`;
  }
  if (variant === "destructive") {
    return `${base} bg-red-100 text-red-700`;
  }
  return `${base} bg-slate-900 text-white`;
}

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  return <span className={`${badgeClasses(variant)} ${className}`.trim()} {...props} />;
}
