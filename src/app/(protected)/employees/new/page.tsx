"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../../../core/db/supabase";
import { useMe } from "../../../../core/auth/useMe";
import {
  canManage as canManagePermissions,
  permissionsLoaded,
} from "../../../../core/auth/permissions";
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
    return <div>Loading permissions...</div>;
  }

  if (!canManage) {
    return <div>You don’t have permission to perform this action.</div>;
  }

  return (
    <div>
      <h1>New Employee</h1>
      <EmployeeForm
        initialValues={{
          firstName: "",
          lastName: "",
          email: "",
          isActive: true,
          payrollId: "",
          notes: "",
        }}
        submitLabel="Create Employee"
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
                  ? "You don’t have permission to perform this action."
                  : (body.error ?? "Failed to create employee."),
              );
            }
            router.push(`/employees/${body.data.id}`);
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Create failed.");
          }
        }}
      />
    </div>
  );
}
