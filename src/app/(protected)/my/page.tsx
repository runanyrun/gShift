"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resolvePostLoginRoute } from "../../../core/auth/post-login-routing";
import { useMe } from "../../../core/auth/useMe";
import { createBrowserSupabaseClient } from "../../../core/db/supabase";

interface MyShiftResponse {
  id: string;
  starts_at: string;
  ends_at: string;
}

export default function MyDashboardPage() {
  const router = useRouter();
  const { data: me, loading } = useMe();
  const target = me ? resolvePostLoginRoute(me) : null;
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<MyShiftResponse[]>([]);

  const employeeName = useMemo(() => {
    if (!me?.employee) {
      return "Employee";
    }
    return `${me.employee.first_name} ${me.employee.last_name}`.trim();
  }, [me]);

  useEffect(() => {
    if (target && target !== "/my") {
      router.replace(target);
    }
  }, [router, target]);

  useEffect(() => {
    if (!me || target !== "/my") {
      return;
    }

    let mounted = true;
    setShiftLoading(true);
    setShiftError(null);

    const run = async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) {
        throw new Error("Auth session missing.");
      }

      const response = await fetch("/api/my/shifts?days=7", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: MyShiftResponse[];
        error?: { message?: string } | string;
      };
      if (!response.ok || !body.ok) {
        const message =
          typeof body.error === "string"
            ? body.error
            : body.error?.message ?? "Failed to load upcoming shifts.";
        throw new Error(message);
      }
      return body.data ?? [];
    };

    run()
      .then((rows) => {
        if (!mounted) {
          return;
        }
        setShifts(rows);
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setShiftError(
          error instanceof Error ? error.message : "Failed to load upcoming shifts.",
        );
      })
      .finally(() => {
        if (!mounted) {
          return;
        }
        setShiftLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [me, target]);

  if (loading || !me) {
    return <div>Loading dashboard...</div>;
  }

  if (target !== "/my") {
    return <div>Redirecting...</div>;
  }

  return (
    <main>
      <h1>My Dashboard</h1>
      <p>
        {employeeName} @ {me.tenant?.name ?? me.tenant?.id ?? "Unknown tenant"}
      </p>
      <nav>
        <Link href="/employees">Employee Directory</Link> | <Link href="/dashboard">Try Admin Dashboard</Link>
      </nav>

      <section>
        <h2>My Shifts (Next 7 days)</h2>
        {shiftError ? <p>{shiftError}</p> : null}
        {shiftLoading ? <p>Loading shifts...</p> : null}
        {!shiftLoading && !shiftError && shifts.length === 0 ? <p>No upcoming shifts</p> : null}
        {!shiftLoading && shifts.length > 0 ? (
          <ul>
            {shifts.map((shift) => (
              <li key={shift.id}>
                {shift.starts_at} - {shift.ends_at} (Location: TBD, Role: TBD)
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2>Time Off</h2>
        <p>Time off summary is coming soon.</p>
      </section>
    </main>
  );
}
