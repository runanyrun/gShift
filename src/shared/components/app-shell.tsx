"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { MeProvider, useMe } from "../../core/auth/useMe";
import { canManage } from "../../core/auth/permissions";

function AppShellContent({ children }: { children: ReactNode }) {
  const { data, loading, error } = useMe();
  const isManager = canManage(data?.permissions ?? []);

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
        <nav aria-label="Primary">
          <Link href="/dashboard">Dashboard</Link> | <Link href="/my">My</Link>
          {isManager ? (
            <>
              {" "}
              | <Link href="/employees">Employees</Link> | Settings:{" "}
              <Link href="/settings/job-titles">Job Titles</Link> /{" "}
              <Link href="/settings/departments">Departments</Link> /{" "}
              <Link href="/settings/locations">Locations</Link>
            </>
          ) : null}
        </nav>
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
