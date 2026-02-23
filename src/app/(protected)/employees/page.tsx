"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../../core/db/supabase";

interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        setError(loadError instanceof Error ? loadError.message : "Failed to load employees.");
      }
    }

    load().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <h1>Employees</h1>
      <p>
        <Link href="/employees/new">Add Employee</Link>
      </p>
      {error ? <p>{error}</p> : null}
      <ul>
        {employees.map((employee) => (
          <li key={employee.id}>
            <Link href={`/employees/${employee.id}`}>
              {employee.firstName} {employee.lastName}
            </Link>{" "}
            - {employee.email} ({employee.isActive ? "active" : "inactive"})
          </li>
        ))}
      </ul>
    </div>
  );
}
