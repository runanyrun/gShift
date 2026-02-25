"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { respondAssignment } from "../../../lib/rpc";

interface AssignmentRow {
  id: string;
  status: string;
  invited_at?: string | null;
  jobs?: { title?: string; work_date?: string; start_time?: string; end_time?: string } | null;
}

export default function WorkerAssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Please sign in.");
    }

    const { data, error: listError } = await supabase
      .from("job_assignments")
      .select("id,status,invited_at,jobs(title,work_date,start_time,end_time)")
      .eq("worker_id", user.id)
      .eq("status", "pending")
      .order("invited_at", { ascending: false });

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

  async function onRespond(assignmentId: string, accept: boolean) {
    setError(null);
    try {
      await respondAssignment(assignmentId, accept);
      await load();
      alert(accept ? "Assignment accepted." : "Assignment declined.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to respond assignment.";
      setError(message);
      alert(message);
    }
  }

  return (
    <main>
      <h1>My Pending Assignments</h1>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && rows.length === 0 ? <p>No pending assignments.</p> : null}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <p>{row.jobs?.title ?? "Untitled job"}</p>
            <p>
              {row.jobs?.work_date ?? "-"} {row.jobs?.start_time ?? "-"} - {row.jobs?.end_time ?? "-"}
            </p>
            <button type="button" onClick={() => void onRespond(row.id, true)}>
              Accept
            </button>{" "}
            <button type="button" onClick={() => void onRespond(row.id, false)}>
              Decline
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
