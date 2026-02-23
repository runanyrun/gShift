"use client";

import { ReactNode } from "react";
import { MeProvider, useMe } from "../../core/auth/useMe";

function AppShellContent({ children }: { children: ReactNode }) {
  const { data, loading, error } = useMe();

  return (
    <div>
      <header>
        {loading ? <p>Loading user...</p> : null}
        {error ? <p>{error}</p> : null}
        {data ? (
          <p>
            User: {data.user.name ?? data.user.email ?? data.user.id} | Tenant:{" "}
            {data.tenant ? data.tenant.name ?? data.tenant.id : "not-connected"}
          </p>
        ) : null}
      </header>
      <main>{children}</main>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MeProvider>
      <AppShellContent>{children}</AppShellContent>
    </MeProvider>
  );
}
