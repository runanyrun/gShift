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
import { readEmployeeLocalMetaMap } from "../../../lib/employee-local-meta";

interface EmployeeListItem {
  id: string;
  full_name: string;
  location_id: string;
  role_id: string;
  hourly_rate: number | null;
  active: boolean;
}

type ApiResponse<T> = { ok: boolean; data?: T; error?: string };

async function fetchWithAuth<T>(path: string): Promise<T> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Auth session missing.");
  }

  const response = await fetch(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.ok || !body.data) {
    throw new Error(body.error ?? "Failed to load data.");
  }
  return body.data;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locationMap, setLocationMap] = useState<Map<string, string>>(new Map());
  const [roleMap, setRoleMap] = useState<Map<string, string>>(new Map());
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
        const [employeeRows, locationRows, roleRows] = await Promise.all([
          fetchWithAuth<EmployeeListItem[]>("/api/employees"),
          fetchWithAuth<Array<{ id: string; name: string }>>("/api/locations"),
          fetchWithAuth<Array<{ id: string; name: string }>>("/api/roles"),
        ]);

        if (!mounted) {
          return;
        }

        setEmployees(employeeRows);
        setLocationMap(new Map(locationRows.map((item) => [item.id, item.name])));
        setRoleMap(new Map(roleRows.map((item) => [item.id, item.name])));
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

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const localMetaMap = useMemo(() => readEmployeeLocalMetaMap(), []);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return employees;
    }

    return employees.filter((employee) => {
      const email = localMetaMap[employee.id]?.email ?? "";
      const haystack = `${employee.full_name} ${email} ${locationMap.get(employee.location_id) ?? ""} ${roleMap.get(employee.role_id) ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [employees, search, localMetaMap, locationMap, roleMap]);

  const activeCount = useMemo(
    () => employees.filter((employee) => employee.active).length,
    [employees],
  );
  const pendingAccessCount = useMemo(
    () => employees.filter((employee) => {
      const meta = localMetaMap[employee.id];
      return meta?.portalAccessEnabled && meta.email.trim().length > 0;
    }).length,
    [employees, localMetaMap],
  );

  return (
    <section className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manage your team with clear profile, work, pay, and access defaults."
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
        <KpiCard label="Access ready" value={String(pendingAccessCount)} hint="Employees with email + portal access enabled" />
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
                    <TableHead>Work</TableHead>
                    <TableHead>Pay</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => {
                    const email = localMetaMap[employee.id]?.email ?? "";
                    const portalEnabled = localMetaMap[employee.id]?.portalAccessEnabled ?? false;
                    const locationName = locationMap.get(employee.location_id) ?? "Set a location to make this employee schedulable.";
                    const roleName = roleMap.get(employee.role_id) ?? "Set a primary role to use scheduling defaults.";
                    const hourlyRate = typeof employee.hourly_rate === "number"
                      ? `${employee.hourly_rate.toFixed(2)} / hr`
                      : "Add an hourly default to prefill shifts faster.";

                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          {canManage ? <Link href={`/employees/${employee.id}`}>{employee.full_name || "Unnamed"}</Link> : (employee.full_name || "Unnamed")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm text-slate-900">{locationName}</p>
                            <p className="text-xs text-slate-500">{roleName}</p>
                          </div>
                        </TableCell>
                        <TableCell>{hourlyRate}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant={portalEnabled ? "secondary" : "outline"}>
                              {portalEnabled ? "Portal access on" : "Invite later"}
                            </Badge>
                            <p className="text-xs text-slate-500">{email || "No email yet"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.active ? "secondary" : "outline"}>{employee.active ? "Active" : "Inactive"}</Badge>
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
