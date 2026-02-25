import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline";
};

function buttonClasses(variant: ButtonProps["variant"] = "default") {
  const base =
    "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50";

  if (variant === "secondary") {
    return `${base} bg-slate-100 text-slate-900 hover:bg-slate-200`;
  }
  if (variant === "destructive") {
    return `${base} bg-red-600 text-white hover:bg-red-700`;
  }
  if (variant === "outline") {
    return `${base} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`;
  }

  return `${base} bg-slate-900 text-white hover:bg-slate-800`;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", variant = "default", ...props },
  ref,
) {
  return <button ref={ref} className={`${buttonClasses(variant)} ${className}`.trim()} {...props} />;
});
