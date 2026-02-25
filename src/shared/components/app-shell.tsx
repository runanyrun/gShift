"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { MeProvider, useMe } from "../../core/auth/useMe";
import { canManage } from "../../core/auth/permissions";
import { ActiveTenantDropdown } from "./active-tenant-dropdown";
import { signOut } from "../../lib/auth-client";

function AppShellContent({ children }: { children: ReactNode }) {
  const { data, loading, error } = useMe();
  const isManager = canManage(data?.permissions);

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
        <ActiveTenantDropdown />
        <nav aria-label="Primary">
          <Link href="/dashboard">Dashboard</Link> | <Link href="/my">My</Link> |{" "}
          <Link href="/jobs">Jobs</Link> | <Link href="/worker/assignments">Worker Assignments</Link> |{" "}
          <Link href="/worker/history">Worker History</Link>
          {isManager ? (
            <>
              {" "}
              | <Link href="/employees">Employees</Link> | <Link href="/manager/jobs">Manager Jobs</Link> |{" "}
              <Link href="/manager/complete">Manager Complete</Link> | Settings:{" "}
              <Link href="/settings/job-titles">Job Titles</Link> /{" "}
              <Link href="/settings/departments">Departments</Link> /{" "}
              <Link href="/settings/locations">Locations</Link>
            </>
          ) : null}
          {isManager ? (
            <>
              {" "}
              | <Link href="/admin/smoke">Admin Smoke</Link>
            </>
          ) : null}
        </nav>
        <button
          type="button"
          onClick={() => {
            void signOut().then(() => {
              window.location.href = "/login";
            });
          }}
        >
          Sign out
        </button>
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
