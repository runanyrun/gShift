import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
};

function buttonClasses(
  variant: ButtonProps["variant"] = "default",
  size: ButtonProps["size"] = "md",
) {
  const base =
    "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-lg";

  const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "h-8 px-3 text-xs gap-1.5",
    md: "h-9 px-4 text-sm gap-2",
    lg: "h-11 px-6 text-sm gap-2",
    icon: "h-9 w-9 text-sm",
  };

  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    default: "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300",
    destructive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm",
    outline:
      "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
  };

  return `${base} ${sizes[size ?? "md"]} ${variants[variant ?? "default"]}`;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", variant = "default", size = "md", ...props },
  ref,
) {
  return <button ref={ref} className={`${buttonClasses(variant, size)} ${className}`.trim()} {...props} />;
});
