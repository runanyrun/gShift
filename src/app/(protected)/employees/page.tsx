"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "../../../core/db/supabase";
import { useMe } from "../../../core/auth/useMe";
import { toast } from "../../../components/ui/sonner";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { PageHeader } from "../../../components/layout/PageHeader";
import { DataTableToolbar } from "../../../components/ui/data-table-toolbar";
import { KpiCard } from "../../../components/ui/kpi-card";
import { Section } from "../../../components/ui/section";
import { Skeleton } from "../../../components/ui/skeleton";
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: me } = useMe();
  const canManage = canManagePermissions(me?.permissions);
  const permissionsAreLoaded = permissionsLoaded(me?.permissions);
  const showNoPermission =
    searchParams.get("error") === "no-permission" &&
    permissionsAreLoaded &&
    !canManage;
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
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
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return employees;
    }

    return employees.filter((employee) => {
      const fullName = employee.full_name ?? `${employee.firstName ?? ""} ${employee.lastName ?? ""}`;
      const haystack = `${fullName} ${employee.email ?? ""} ${employee.location_name ?? ""} ${employee.role_name ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [employees, search]);

  const activeCount = useMemo(
    () => employees.filter((employee) => employee.active ?? employee.isActive ?? false).length,
    [employees],
  );

  return (
    <section className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manage your team, assignments, and rates."
        actions={(
          canManage ? (
            <Link
              href="/employees/new"
              data-testid="btn-add-employee"
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

      {showNoPermission ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">You do not have permission to perform this action.</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Total employees" value={String(employees.length)} hint="Profiles linked to this company" />
        <KpiCard label="Active" value={String(activeCount)} hint="Available for scheduling" />
        <KpiCard label="Permissions mode" value={canManage ? "Manager" : "Worker"} hint="Page actions adapt by role" />
      </div>

      <Section title="Employee directory" description="Primary task: search, review, and open employee profiles.">
        <Card>
          <CardContent className="p-0">
            <DataTableToolbar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by name, email, location, or role"
            />
            {loading ? (
              <div className="space-y-2 px-4 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No employees yet"
                  description="Add your first employee to start scheduling shifts."
                  actionLabel={canManage ? "Add employee" : "Run onboarding"}
                  onAction={() => router.push(canManage ? "/employees/new" : "/onboarding")}
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
                  {filteredEmployees.map((employee) => {
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
      </Section>
    </section>
  );
}
