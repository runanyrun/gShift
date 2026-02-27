import * as React from "react";

export function Skeleton({ className = "" }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`.trim()} />;
}
