"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../../core/db/supabase";
import {
  DashboardOverview,
  DashboardShiftItem,
} from "../../../features/dashboard/dashboard.types";

export default function DashboardPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [shifts, setShifts] = useState<DashboardShiftItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      document.cookie = "sb_access_token=; Path=/; Max-Age=0; SameSite=Lax";
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    const supabase = createBrowserSupabaseClient();

    supabase.auth
      .getSession()
      .then(async ({ data, error: sessionError }) => {
        if (sessionError) {
          throw sessionError;
        }

        const accessToken = data.session?.access_token;
        if (!accessToken) {
          throw new Error("Auth session missing.");
        }

        const requestHeaders = {
          Authorization: `Bearer ${accessToken}`,
        };

        const [overviewResponse, shiftsResponse] = await Promise.all([
          fetch("/api/dashboard/overview", {
            method: "GET",
            headers: requestHeaders,
          }),
          fetch("/api/dashboard/shifts", {
            method: "GET",
            headers: requestHeaders,
          }),
        ]);

        if (!overviewResponse.ok) {
          const body = (await overviewResponse.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to load dashboard overview.");
        }

        if (!shiftsResponse.ok) {
          const body = (await shiftsResponse.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to load dashboard shifts.");
        }

        const [overviewPayload, shiftsPayload] = await Promise.all([
          overviewResponse.json() as Promise<DashboardOverview>,
          shiftsResponse.json() as Promise<DashboardShiftItem[]>,
        ]);

        return { overviewPayload, shiftsPayload };
      })
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setOverview(payload.overviewPayload);
        setShifts(payload.shiftsPayload);
      })
      .catch((fetchError) => {
        if (!mounted) {
          return;
        }
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Unexpected dashboard bootstrap error.";
        setError(message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <div>{error}</div>;
  }

  if (!overview) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div>
      <h1>Tenant Dashboard</h1>
      <nav>
        <Link href="/employees">Employees</Link> |{" "}
        <Link href="/settings/job-titles">Job Titles</Link> |{" "}
        <Link href="/settings/departments">Departments</Link> |{" "}
        <Link href="/settings/locations">Locations</Link>
      </nav>
      <button type="button" onClick={onSignOut} disabled={signingOut}>
        {signingOut ? "Signing out..." : "Sign out"}
      </button>
      <p>
        Company: {overview.companyId}
      </p>
      <p>
        Users: {overview.usersCount} | Shifts: {overview.shiftsCount}
      </p>
      <h2>Shifts</h2>
      {shifts.length === 0 ? (
        <p>No shifts found.</p>
      ) : (
        <ul>
          {shifts.map((shift) => (
            <li key={shift.id}>
              {shift.startsAt} - {shift.endsAt} (user: {shift.userId})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
