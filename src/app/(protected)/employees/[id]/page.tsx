"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../../../core/db/supabase";
import { useMe } from "../../../../core/auth/useMe";
import { canManage as canManagePermissions } from "../../../../core/auth/permissions";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { Card, CardContent } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Section } from "../../../../components/ui/section";
import { Skeleton } from "../../../../components/ui/skeleton";
import { EmployeeForm } from "../../../../shared/components/employee-form";

interface EmployeePayload {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  payrollId: string | null;
  notes: string | null;
  userId: string | null;
}

export default function EmployeeEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [employee, setEmployee] = useState<EmployeePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { data: me } = useMe();
  const canManage = canManagePermissions(me?.permissions);
  const canSeeNotes = canManage;

  async function loadEmployee() {
    const supabase = createBrowserSupabaseClient();
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) {
      throw new Error("Auth session missing.");
    }

    const response = await fetch(`/api/employees/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    });
    const body = (await response.json()) as {
      ok: boolean;
      data?: EmployeePayload;
      error?: string;
    };
    if (!response.ok || !body.ok || !body.data) {
      throw new Error(body.error ?? "Failed to load employee.");
    }
    setEmployee(body.data);
  }

  useEffect(() => {
    let mounted = true;
    loadEmployee()
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Load failed.");
      })
      .finally(() => {
        mounted = false;
      });
  }, [id]);

  async function sendInvite() {
    if (!employee) {
      return;
    }
    setInviteStatus(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) {
        throw new Error("Auth session missing.");
      }

      const response = await fetch(`/api/employees/${id}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          email: employee.email,
          employeeName: `${employee.firstName} ${employee.lastName}`,
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { status: string };
        error?: string;
      };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to send invite.");
      }
      setInviteStatus(`Invite status: ${body.data?.status ?? "pending"}`);
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

  if (!employee) {
    return (
      <section className="space-y-6">
        <PageHeader title="Employee" description="Review profile details, access status, and editable fields." />
        <Skeleton className="h-44 w-full" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`.trim() || "Employee"}
        description="Primary task: update employee profile. Access details stay in a separate section."
        actions={(
          <Link
            href="/employees"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            Back to employees
          </Link>
        )}
      />

      <Section title="Access" description="Invite and account link status for this profile.">
        <Card>
          <CardContent className="space-y-3 p-4">
            {canManage ? (
              employee.userId ? (
                <p className="text-sm text-slate-700">Account status: linked ({employee.userId})</p>
              ) : (
                <>
                  <EmptyState
                    title="Employee account is not linked yet"
                    description="Send an invite so this employee can access worker flows."
                    actionLabel="Send invite"
                    onAction={() => void sendInvite()}
                  />
                  {inviteStatus ? <p className="text-sm text-slate-600">{inviteStatus}</p> : null}
                </>
              )
            ) : (
              <p className="text-sm text-slate-600">You do not have permission to manage account access.</p>
            )}
          </CardContent>
        </Card>
      </Section>

      <Section title="Profile" description="Edit employee information used in scheduling and payroll integrations.">
        <EmployeeForm
          initialValues={{
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            isActive: employee.isActive,
            payrollId: employee.payrollId ?? "",
            notes: employee.notes ?? "",
          }}
          submitLabel="Save employee"
          error={formError}
          showNotes={Boolean(canSeeNotes)}
          readOnly={!canManage}
          onSubmit={async (values) => {
            setFormError(null);
            try {
              if (!canManage) {
                setFormError("You do not have permission to perform this action.");
                return;
              }
              const supabase = createBrowserSupabaseClient();
              const { data, error: sessionError } = await supabase.auth.getSession();
              if (sessionError || !data.session?.access_token) {
                throw new Error("Auth session missing.");
              }
              const response = await fetch(`/api/employees/${id}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${data.session.access_token}`,
                },
                body: JSON.stringify(values),
              });
              const body = (await response.json()) as {
                ok: boolean;
                error?: string;
                data?: EmployeePayload;
              };
              if (!response.ok || !body.ok || !body.data) {
                throw new Error(body.error ?? "You do not have permission to perform this action.");
              }
              setEmployee(body.data);
            } catch (submitError) {
              setFormError(
                submitError instanceof Error
                  ? submitError.message
                  : "You do not have permission to perform this action.",
              );
            }
          }}
        />
      </Section>
    </section>
  );
}
