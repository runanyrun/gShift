import * as React from "react";

export function PageShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={`mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8 ${className}`.trim()}>
      {children}
    </main>
  );
}
