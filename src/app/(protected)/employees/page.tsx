"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "../../../core/db/supabase";
import { useMe } from "../../../core/auth/useMe";
import { toast } from "../../../components/ui/sonner";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState } from "../../../components/common/EmptyState";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  canManage as canManagePermissions,
  normalizePermissionKey,
  permissionsLoaded,
} from "../../../core/auth/permissions";

interface EmployeeListItem {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
  full_name?: string;
  location_name?: string;
  role_name?: string;
  hourly_rate?: number | null;
  active?: boolean;
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
        const message = loadError instanceof Error ? loadError.message : "Failed to load employees.";
        setError(message);
        toast({ title: "Failed to load employees", description: message });
      }
    }

    load().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Employees"
        description="Manage your team, assignments, and rates."
        actions={(
          canManage ? (
            <Link
              href="/employees/new"
              className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Add employee
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              Run onboarding
            </Link>
          )
        )}
      />

      {showNoPermission ? <p>You don’t have permission to perform this action.</p> : null}
      {me ? <p>Permissions: {permissionsText}</p> : null}
      {error ? <p>{error}</p> : null}

      <Card>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No employees yet"
                description="Add your first employee to start scheduling shifts."
                action={(
                  <Link
                    href="/onboarding"
                    className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    Run onboarding
                  </Link>
                )}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Hourly rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const fullName =
                    employee.full_name
                    ?? (`${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || "Unnamed");
                  const locationName = employee.location_name ?? "-";
                  const roleName = employee.role_name ?? "-";
                  const hourlyRate = typeof employee.hourly_rate === "number" ? employee.hourly_rate.toFixed(2) : "-";
                  const active = employee.active ?? employee.isActive ?? false;

                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        {canManage ? <Link href={`/employees/${employee.id}`}>{fullName}</Link> : fullName}
                      </TableCell>
                      <TableCell>{locationName}</TableCell>
                      <TableCell>{roleName}</TableCell>
                      <TableCell>{hourlyRate}</TableCell>
                      <TableCell>
                        <Badge variant={active ? "secondary" : "outline"}>{active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
