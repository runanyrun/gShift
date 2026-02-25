import * as React from "react";

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Toast({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-md border border-slate-200 bg-white p-3 shadow-sm", className)} {...props} />;
}

export function ToastTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h4 className={cx("text-sm font-semibold text-slate-900", className)} {...props} />;
}

export function ToastDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("text-xs text-slate-600", className)} {...props} />;
}
