"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "../../../../core/db/supabase";
import { useMe } from "../../../../core/auth/useMe";
import { EmployeeForm } from "../../../../shared/components/employee-form";

export default function EmployeeCreatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { data: me } = useMe();
  const canSeeNotes =
    me?.permissions.includes("management") || me?.permissions.includes("administration");

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
              throw new Error(body.error ?? "Failed to create employee.");
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
