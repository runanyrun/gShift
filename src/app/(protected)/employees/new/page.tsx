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
import { EmployeeForm } from "../../../../shared/components/employee-form";

export default function EmployeeCreatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { data: me } = useMe();
  const permissionsAreLoaded = permissionsLoaded(me?.permissions);
  const canManage = canManagePermissions(me?.permissions);
  const canSeeNotes = canManage;

  useEffect(() => {
    if (permissionsAreLoaded && !canManage) {
      router.replace("/employees?error=no-permission");
    }
  }, [canManage, permissionsAreLoaded, router]);

  if (!permissionsAreLoaded) {
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
        description="Primary task: create a single employee profile with clear required fields."
        actions={(
          <Link
            href="/employees"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            Back to employees
          </Link>
        )}
      />

      <Section title="Profile" description="Fill in identity and payroll fields, then save to create the record.">
        <EmployeeForm
          initialValues={{
            firstName: "",
            lastName: "",
            email: "",
            isActive: true,
            payrollId: "",
            notes: "",
          }}
          submitLabel="Create employee"
          error={error}
          showNotes={Boolean(canSeeNotes)}
          onSubmit={async (values) => {
            setError(null);
            try {
              const supabase = createBrowserSupabaseClient();
              const { data, error: sessionError } = await supabase.auth.getSession();
              if (sessionError || !data.session?.access_token) {
                throw new Error("Auth session missing.");
              }

              const response = await fetch("/api/employees", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${data.session.access_token}`,
                },
                body: JSON.stringify(values),
              });
              const body = (await response.json()) as {
                ok: boolean;
                data?: { id: string };
                error?: string;
              };
              if (!response.ok || !body.ok || !body.data?.id) {
                throw new Error(
                  response.status === 401 || response.status === 403
                    ? "You do not have permission to perform this action."
                    : (body.error ?? "Failed to create employee."),
                );
              }
              router.push(`/employees/${body.data.id}`);
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : "Create failed.");
            }
          }}
        />
      </Section>
    </section>
  );
}
