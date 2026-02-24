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
  acceptance_status: "pending" | "accepted" | "declined";
  responded_at: string | null;
}

export default function MyDashboardPage() {
  const router = useRouter();
  const { data: me, loading } = useMe();
  const target = me ? resolvePostLoginRoute(me) : null;
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<MyShiftResponse[]>([]);
  const [respondingShiftIds, setRespondingShiftIds] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

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

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const respondToShift = async (shiftId: string, status: "accepted" | "declined") => {
    let previousShift: MyShiftResponse | undefined;
    const optimisticRespondedAt = new Date().toISOString();

    setRespondingShiftIds((current) => ({ ...current, [shiftId]: true }));
    setShiftError(null);
    setShifts((current) =>
      current.map((shift) => {
        if (shift.id !== shiftId) {
          return shift;
        }
        previousShift = shift;
        return { ...shift, acceptance_status: status, responded_at: optimisticRespondedAt };
      }),
    );

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) {
        throw new Error("Auth session missing.");
      }

      const response = await fetch(`/api/my/shifts/${shiftId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: Pick<MyShiftResponse, "id" | "acceptance_status" | "responded_at">;
        error?: { message?: string } | string;
      };
      if (!response.ok || !body.ok || !body.data) {
        const message =
          typeof body.error === "string"
            ? body.error
            : body.error?.message ?? "Failed to respond to shift.";
        throw new Error(message);
      }

      setShifts((current) =>
        current.map((shift) =>
          shift.id === shiftId
            ? {
                ...shift,
                acceptance_status: body.data!.acceptance_status,
                responded_at: body.data!.responded_at,
              }
            : shift,
        ),
      );
      setToast({ type: "success", message: `Shift ${status}.` });
    } catch (error) {
      if (previousShift) {
        setShifts((current) =>
          current.map((shift) => (shift.id === shiftId ? previousShift! : shift)),
        );
      }
      const message =
        error instanceof Error ? error.message : "Failed to respond to shift.";
      setShiftError(message);
      setToast({ type: "error", message });
    } finally {
      setRespondingShiftIds((current) => {
        const next = { ...current };
        delete next[shiftId];
        return next;
      });
    }
  };

  const renderStatusLabel = (status: MyShiftResponse["acceptance_status"]) => {
    if (status === "accepted") {
      return "Accepted";
    }
    if (status === "declined") {
      return "Declined";
    }
    return "Pending";
  };
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
        {toast ? (
          <p>
            {toast.type === "success" ? "Success:" : "Error:"} {toast.message}
          </p>
        ) : null}
        {shiftError ? <p>{shiftError}</p> : null}
        {shiftLoading ? <p>Loading shifts...</p> : null}
        {!shiftLoading && !shiftError && shifts.length === 0 ? <p>No upcoming shifts</p> : null}
        {!shiftLoading && shifts.length > 0 ? (
          <ul>
            {shifts.map((shift) => (
              <li key={shift.id}>
                <div>
                  {shift.starts_at} - {shift.ends_at} (Location: TBD, Role: TBD)
                </div>
                <div>Status: {renderStatusLabel(shift.acceptance_status)}</div>
                {shift.responded_at ? <div>Responded: {shift.responded_at}</div> : null}
                {shift.acceptance_status === "pending" ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => void respondToShift(shift.id, "accepted")}
                      disabled={Boolean(respondingShiftIds[shift.id])}
                    >
                      Accept
                    </button>{" "}
                    <button
                      type="button"
                      onClick={() => void respondToShift(shift.id, "declined")}
                      disabled={Boolean(respondingShiftIds[shift.id])}
                    >
                      Decline
                    </button>
                  </div>
                ) : null}
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
