"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../../../../core/db/supabase";
import { useMe } from "../../../../core/auth/useMe";
import { canManage as canManagePermissions } from "../../../../core/auth/permissions";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { Card, CardContent } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Section } from "../../../../components/ui/section";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Breadcrumbs } from "../../../../components/ui/breadcrumbs";
import { Badge } from "../../../../components/ui/badge";
import { EmployeeForm, type EmployeeOption } from "../../../../shared/components/employee-form";
import { readEmployeeLocalMeta, writeEmployeeLocalMeta } from "../../../../lib/employee-local-meta";

interface EmployeePayload {
  id: string;
  full_name: string;
  location_id: string;
  role_id: string;
  active: boolean;
  hourly_rate: number | null;
}

type ApiResponse<T> = { ok: boolean; data?: T; error?: string };

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Auth session missing.");
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.ok || !body.data) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body.data;
}

export default function EmployeeEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [employee, setEmployee] = useState<EmployeePayload | null>(null);
  const [locations, setLocations] = useState<EmployeeOption[]>([]);
  const [roles, setRoles] = useState<EmployeeOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: me } = useMe();
  const canManage = canManagePermissions(me?.permissions);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [employeeRow, locationRows, roleRows] = await Promise.all([
          fetchWithAuth<EmployeePayload>(`/api/employees/${id}`),
          fetchWithAuth<Array<{ id: string; name: string }>>("/api/locations"),
          fetchWithAuth<Array<{ id: string; name: string }>>("/api/roles"),
        ]);

        if (!mounted) {
          return;
        }

        setEmployee(employeeRow);
        setLocations(locationRows.map((item) => ({ id: item.id, name: item.name })));
        setRoles(roleRows.map((item) => ({ id: item.id, name: item.name })));
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Load failed.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  const localMeta = useMemo(() => (employee ? readEmployeeLocalMeta(employee.id) : null), [employee]);
  const selectedLocation = locations.find((item) => item.id === employee?.location_id);
  const selectedRole = roles.find((item) => item.id === employee?.role_id);

  async function sendInvite() {
    if (!employee || !localMeta?.email.trim()) {
      setInviteStatus("Add an email first, then enable portal access.");
      return;
    }

    setInviteStatus(null);

    try {
      const body = await fetchWithAuth<{ status: string }>(`/api/employees/${id}/invite`, {
        method: "POST",
        body: JSON.stringify({
          email: localMeta.email,
          employeeName: employee.full_name,
        }),
      });

      setInviteStatus(`Invite status: ${body.status ?? "pending"}`);
    } catch (inviteError) {
      setInviteStatus(inviteError instanceof Error ? inviteError.message : "Invite failed.");
    }
  }

  if (error) {
    return (
      <section className="space-y-6">
        <PageHeader title="Employee" description="Review profile details, access status, and editable fields." />
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </section>
    );
  }

  if (loading || !employee || !localMeta) {
    return (
      <section className="space-y-6">
        <PageHeader title="Employee" description="Review profile details, access status, and editable fields." />
        <Skeleton className="h-44 w-full" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Employees", href: "/employees" },
          { label: employee.full_name || "Employee" },
        ]}
        backHref="/employees"
        backLabel="Back to employees"
      />
      <PageHeader
        title={employee.full_name || "Employee"}
        description="Review and update profile, work defaults, pay mode, and access readiness."
        actions={(
          <Link
            href="/employees"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            Back to employees
          </Link>
        )}
      />

      <Section title="Access" description="Portal readiness is optional until you are ready to invite this employee.">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={localMeta.portalAccessEnabled ? "secondary" : "outline"}>
                {localMeta.portalAccessEnabled ? "Portal access enabled" : "Invite later"}
              </Badge>
              <span className="text-sm text-slate-600">
                {localMeta.email.trim() ? localMeta.email : "Add an email to enable access."}
              </span>
            </div>
            {canManage ? (
              localMeta.portalAccessEnabled ? (
                <div className="space-y-2">
                  {localMeta.email.trim() ? (
                    <button
                      type="button"
                      onClick={() => void sendInvite()}
                      className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                    >
                      Send invite
                    </button>
                  ) : (
                    <EmptyState
                      title="Email needed before invite"
                      description="Enable access is ready, but the employee still needs an email address."
                    />
                  )}
                  {inviteStatus ? <p className="text-sm text-slate-600">{inviteStatus}</p> : null}
                </div>
              ) : (
                <p className="text-sm text-slate-600">This employee can be scheduled now. Enable portal access when you are ready to invite them.</p>
              )
            ) : (
              <p className="text-sm text-slate-600">You do not have permission to manage account access.</p>
            )}
          </CardContent>
        </Card>
      </Section>

      <EmployeeForm
        locations={locations}
        roles={roles}
        initialValues={{
          fullName: employee.full_name,
          locationId: employee.location_id,
          roleId: employee.role_id,
          isActive: employee.active,
          hourlyRate: employee.hourly_rate === null ? "" : String(employee.hourly_rate),
          email: localMeta.email,
          portalAccessEnabled: localMeta.portalAccessEnabled,
          phone: localMeta.phone,
          primaryRoleLabel: localMeta.primaryRoleLabel || selectedRole?.name || "",
          additionalRolesText: localMeta.additionalRolesText,
          availabilityDays: localMeta.availabilityDays,
          payMode: localMeta.payMode,
          payAmount: localMeta.payAmount || (employee.hourly_rate === null ? "" : String(employee.hourly_rate)),
          startDate: localMeta.startDate,
          defaultBreakMinutes: localMeta.defaultBreakMinutes,
          notes: "",
        }}
        submitLabel="Save employee"
        error={formError}
        readOnly={!canManage}
        onSubmit={async (values) => {
          setFormError(null);
          try {
            if (!canManage) {
              setFormError("You do not have permission to perform this action.");
              return;
            }

            const updated = await fetchWithAuth<EmployeePayload>(`/api/employees/${id}`, {
              method: "PATCH",
              body: JSON.stringify({
                full_name: values.fullName,
                location_id: values.locationId,
                role_id: values.roleId,
                active: values.isActive,
                hourly_rate: values.payMode === "hourly"
                  ? (values.payAmount.trim() || values.hourlyRate.trim() || null)
                  : (values.hourlyRate.trim() || null),
              }),
            });

            writeEmployeeLocalMeta(id, {
              email: values.email,
              phone: values.phone,
              portalAccessEnabled: values.portalAccessEnabled,
              primaryRoleLabel: values.primaryRoleLabel,
              additionalRolesText: values.additionalRolesText,
              availabilityDays: values.availabilityDays,
              payMode: values.payMode,
              payAmount: values.payAmount,
              startDate: values.startDate,
              defaultBreakMinutes: values.defaultBreakMinutes,
            });

            setEmployee(updated);
          } catch (submitError) {
            setFormError(
              submitError instanceof Error
                ? submitError.message
                : "You do not have permission to perform this action.",
            );
          }
        }}
      />

      <Section title="Current assignment" description="Helpful hints instead of blank fields.">
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Location</p>
              <p className="text-sm text-slate-900">{selectedLocation?.name ?? "Pick a location to make this employee schedulable."}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Primary role</p>
              <p className="text-sm text-slate-900">{selectedRole?.name ?? "Select a role to use shift defaults."}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pay</p>
              <p className="text-sm text-slate-900">
                {employee.hourly_rate === null ? "Set an hourly default when you want quick shift creation to prefill." : `${employee.hourly_rate.toFixed(2)} per hour`}
              </p>
            </div>
          </CardContent>
        </Card>
      </Section>
    </section>
  );
}
