import * as React from "react";

export function Skeleton({ className = "" }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`animate-pulse rounded-md bg-slate-200/80 ${className}`.trim()} />;
}
