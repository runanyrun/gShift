import * as React from "react";

export function Separator({
  className = "",
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  if (orientation === "vertical") {
    return <div aria-hidden="true" className={`h-full w-px bg-slate-200 ${className}`.trim()} />;
  }

  return <div aria-hidden="true" className={`h-px w-full bg-slate-200 ${className}`.trim()} />;
}
