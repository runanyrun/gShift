import * as React from "react";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "info";
};

function badgeClasses(variant: BadgeProps["variant"] = "default") {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

  const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: `${base} bg-indigo-100 text-indigo-700`,
    secondary: `${base} bg-slate-100 text-slate-700`,
    outline: `${base} border border-slate-300 text-slate-600 bg-white`,
    destructive: `${base} bg-red-100 text-red-700`,
    success: `${base} bg-emerald-100 text-emerald-700`,
    warning: `${base} bg-amber-100 text-amber-700`,
    info: `${base} bg-sky-100 text-sky-700`,
  };

  return variants[variant ?? "default"];
}

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  return <span className={`${badgeClasses(variant)} ${className}`.trim()} {...props} />;
}
