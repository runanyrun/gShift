import * as React from "react";

export function PageShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <main className={`mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8 ${className}`.trim()}>{children}</main>;
}
