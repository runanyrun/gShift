"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { getActiveTenantId } from "../../../lib/tenancy";
import { completeAssignment } from "../../../lib/rpc";

interface AssignmentRow {
  id: string;
  worker_id: string;
  status: string;
  accepted_at?: string | null;
  jobs?: { tenant_id?: string; title?: string } | null;
}

export default function ManagerCompletePage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minutesWorked, setMinutesWorked] = useState<Record<string, string>>({});
  const [score, setScore] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});

  async function load() {
    const tenantId = getActiveTenantId();
    if (!tenantId) {
      setRows([]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error: listError } = await supabase
      .from("job_assignments")
      .select("id,worker_id,status,accepted_at,jobs!inner(tenant_id,title)")
      .eq("jobs.tenant_id", tenantId)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: false });

    if (listError) {
      throw new Error(listError.message);
    }
    setRows((data ?? []) as AssignmentRow[]);
  }

  useEffect(() => {
    let mounted = true;
    load()
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load assignments.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onActiveTenantChanged = () => {
      void load().catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load assignments.");
      });
    };
    window.addEventListener("active-tenant-changed", onActiveTenantChanged);
    return () => {
      window.removeEventListener("active-tenant-changed", onActiveTenantChanged);
    };
  }, []);

  async function onComplete(event: FormEvent, assignmentId: string) {
    event.preventDefault();
    setError(null);

    try {
      const minutes = Number.parseInt(minutesWorked[assignmentId] ?? "0", 10);
      const parsedScore = score[assignmentId] ? Number.parseInt(score[assignmentId], 10) : null;
      const parsedNote = (note[assignmentId] ?? "").trim();

      await completeAssignment(assignmentId, minutes, parsedScore, parsedNote || null);
      alert("Assignment completed.");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete assignment.";
      setError(message);
      alert(message);
    }
  }

  return (
    <main>
      <h1>Complete Assignments</h1>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && rows.length === 0 ? <p>No accepted assignments for active tenant.</p> : null}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <p>{row.jobs?.title ?? "Untitled job"}</p>
            <p>Worker: {row.worker_id}</p>
            <form onSubmit={(event) => void onComplete(event, row.id)}>
              <input
                type="number"
                min={1}
                placeholder="Minutes"
                value={minutesWorked[row.id] ?? ""}
                onChange={(event) =>
                  setMinutesWorked((current) => ({ ...current, [row.id]: event.target.value }))
                }
                required
              />
              <input
                type="number"
                min={1}
                max={5}
                placeholder="Score (optional)"
                value={score[row.id] ?? ""}
                onChange={(event) => setScore((current) => ({ ...current, [row.id]: event.target.value }))}
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={note[row.id] ?? ""}
                onChange={(event) => setNote((current) => ({ ...current, [row.id]: event.target.value }))}
              />
              <button type="submit">Complete</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
