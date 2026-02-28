"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../../../core/db/supabase";
import { useMe } from "../../../../core/auth/useMe";
import {
  canManage as canManagePermissions,
  permissionsLoaded,
} from "../../../../core/auth/permissions";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { Section } from "../../../../components/ui/section";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Breadcrumbs } from "../../../../components/ui/breadcrumbs";
import { EmployeeForm, type EmployeeFormValues, type EmployeeOption } from "../../../../shared/components/employee-form";
import { getDefaultEmployeeLocalMeta, writeEmployeeLocalMeta } from "../../../../lib/employee-local-meta";

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

export default function EmployeeCreatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [locations, setLocations] = useState<EmployeeOption[]>([]);
  const [roles, setRoles] = useState<EmployeeOption[]>([]);
  const { data: me } = useMe();
  const permissionsAreLoaded = permissionsLoaded(me?.permissions);
  const canManage = canManagePermissions(me?.permissions);

  useEffect(() => {
    if (permissionsAreLoaded && !canManage) {
      router.replace("/employees?error=no-permission");
    }
  }, [canManage, permissionsAreLoaded, router]);

  useEffect(() => {
    if (!permissionsAreLoaded || !canManage) {
      return;
    }

    let mounted = true;

    void (async () => {
      setLoadingOptions(true);
      try {
        const [locationRows, roleRows] = await Promise.all([
          fetchWithAuth<Array<{ id: string; name: string }>>("/api/locations"),
          fetchWithAuth<Array<{ id: string; name: string }>>("/api/roles"),
        ]);

        if (!mounted) {
          return;
        }

        setLocations(locationRows.map((item) => ({ id: item.id, name: item.name })));
        setRoles(roleRows.map((item) => ({ id: item.id, name: item.name })));
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load form options.");
      } finally {
        if (mounted) {
          setLoadingOptions(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [permissionsAreLoaded, canManage]);

  if (!permissionsAreLoaded || loadingOptions) {
    return (
      <section className="space-y-6">
        <PageHeader title="New employee" description="Create a profile and link it to your company workspace." />
        <Skeleton className="h-40 w-full" />
      </section>
    );
  }

  if (!canManage) {
    return (
      <section className="space-y-6">
        <PageHeader title="New employee" description="Create a profile and link it to your company workspace." />
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          You do not have permission to perform this action.
        </p>
      </section>
    );
  }

  if (locations.length === 0 || roles.length === 0) {
    return (
      <section className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Employees", href: "/employees" },
            { label: "New employee" },
          ]}
          backHref="/employees"
          backLabel="Back to employees"
        />
        <PageHeader title="New employee" description="Create a profile and link it to your company workspace." />
        <Section
          title="Before you add people"
          description="Employees need at least one location and one role so they can be scheduled immediately."
        >
          <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Add your first location and role in onboarding or in settings, then come back here.
          </p>
        </Section>
      </section>
    );
  }

  const localDefaults = getDefaultEmployeeLocalMeta();

  return (
    <section className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Employees", href: "/employees" },
          { label: "New employee" },
        ]}
        backHref="/employees"
        backLabel="Back to employees"
      />
      <PageHeader
        title="New employee"
        description="Create a scheduling-ready employee record with clear work, pay, and access defaults."
        actions={(
          <Link
            href="/employees"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            Back to employees
          </Link>
        )}
      />

      <EmployeeForm
        locations={locations}
        roles={roles}
        initialValues={{
          fullName: "",
          locationId: locations[0]?.id ?? "",
          roleId: roles[0]?.id ?? "",
          isActive: true,
          hourlyRate: "",
          email: localDefaults.email,
          portalAccessEnabled: localDefaults.portalAccessEnabled,
          phone: localDefaults.phone,
          primaryRoleLabel: roles[0]?.name ?? "",
          additionalRolesText: localDefaults.additionalRolesText,
          availabilityDays: localDefaults.availabilityDays,
          payMode: localDefaults.payMode,
          payAmount: localDefaults.payAmount,
          startDate: localDefaults.startDate,
          defaultBreakMinutes: localDefaults.defaultBreakMinutes,
          notes: "",
        }}
        submitLabel="Create employee"
        error={error}
        onSubmit={async (values: EmployeeFormValues) => {
          setError(null);
          try {
            const data = await fetchWithAuth<{ id: string }>("/api/employees", {
              method: "POST",
              body: JSON.stringify({
                full_name: values.fullName,
                location_id: values.locationId,
                role_id: values.roleId,
                hourly_rate: values.payMode === "hourly"
                  ? (values.payAmount.trim() || values.hourlyRate.trim() || null)
                  : (values.hourlyRate.trim() || null),
                active: values.isActive,
              }),
            });

            writeEmployeeLocalMeta(data.id, {
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

            router.push(`/employees/${data.id}`);
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Create failed.");
          }
        }}
      />
    </section>
  );
}
