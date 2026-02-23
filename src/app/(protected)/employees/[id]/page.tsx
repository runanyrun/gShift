"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../../../core/db/supabase";
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
    return <div>{error}</div>;
  }

  if (!employee) {
    return <div>Loading employee...</div>;
  }

  return (
    <div>
      <h1>
        Employee: {employee.firstName} {employee.lastName}
      </h1>

      <h2>Access & Permissions</h2>
      {employee.userId ? (
        <p>Linked to user: {employee.userId}</p>
      ) : (
        <div>
          <p>No account linked</p>
          <button type="button" onClick={sendInvite}>
            Send Invite
          </button>
          {inviteStatus ? <p>{inviteStatus}</p> : null}
        </div>
      )}

      <EmployeeForm
        initialValues={{
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          isActive: employee.isActive,
          payrollId: employee.payrollId ?? "",
          notes: employee.notes ?? "",
        }}
        submitLabel="Save Employee"
        error={null}
        onSubmit={async (values) => {
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
          const body = (await response.json()) as { ok: boolean; error?: string; data?: EmployeePayload };
          if (!response.ok || !body.ok || !body.data) {
            throw new Error(body.error ?? "Failed to save employee.");
          }
          setEmployee(body.data);
        }}
      />
    </div>
  );
}
