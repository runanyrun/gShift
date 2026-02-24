"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "../../../core/db/supabase";
import { useMe } from "../../../core/auth/useMe";
import {
  canManage as canManagePermissions,
  normalizePermissionKey,
  permissionsLoaded,
} from "../../../core/auth/permissions";

interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const { data: me } = useMe();
  const canManage = canManagePermissions(me?.permissions);
  const permissionsAreLoaded = permissionsLoaded(me?.permissions);
  const showNoPermission =
    searchParams.get("error") === "no-permission" &&
    permissionsAreLoaded &&
    !canManage;
  const permissionsText = (() => {
    if (!permissionsAreLoaded) {
      return "loading...";
    }

    const permissions = me?.permissions;
    if (Array.isArray(permissions)) {
      return permissions.join(", ") || "none";
    }

    if (permissions && typeof permissions === "object") {
      const enabled = Array.from(
        new Set(
          Object.entries(permissions)
        .filter(([, value]) => value === true)
            .map(([key]) => normalizePermissionKey(key))
            .filter((key) => key.length > 0),
        ),
      );
      return enabled.join(", ") || "none";
    }

    return "none";
  })();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session?.access_token) {
          throw new Error("Auth session missing.");
        }
        const response = await fetch("/api/employees", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        });
        const body = (await response.json()) as {
          ok: boolean;
          data?: Array<{
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            isActive: boolean;
          }>;
          error?: string;
        };
        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? "Failed to load employees.");
        }
        if (!mounted) {
          return;
        }
        setEmployees(body.data ?? []);
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load employees.");
      }
    }

    load().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <h1>Employees</h1>
      {showNoPermission ? <p>You don’t have permission to perform this action.</p> : null}
      {me ? <p>Permissions: {permissionsText}</p> : null}
      <p>
        {canManage ? <Link href="/employees/new">Add Employee</Link> : "Read-only view"}
      </p>
      {error ? <p>{error}</p> : null}
      <ul>
        {employees.map((employee) => (
          <li key={employee.id}>
            {canManage ? (
              <Link href={`/employees/${employee.id}`}>
                {employee.firstName} {employee.lastName}
              </Link>
            ) : (
              <span>
                {employee.firstName} {employee.lastName}
              </span>
            )}{" "}
            - {employee.email} ({employee.isActive ? "active" : "inactive"}){" "}
            {canManage ? <Link href={`/employees/${employee.id}`}>Edit</Link> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
