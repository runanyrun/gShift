"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";

interface AssignmentRow {
  id: string;
  status: string;
  responded_at: string | null;
  completed_at: string | null;
  jobs?: {
    title?: string;
    work_date?: string;
    start_time?: string;
    end_time?: string;
  } | null;
}

interface RatingRow {
  assignment_id: string;
  score?: number | null;
  note?: string | null;
}

export default function WorkerHistoryPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          throw new Error("Please sign in.");
        }

        const { data: assignments, error: assignmentsError } = await supabase
          .from("job_assignments")
          .select("id,status,responded_at,completed_at,jobs(title,work_date,start_time,end_time)")
          .eq("worker_id", user.id)
          .in("status", ["accepted", "completed", "declined"])
          .order("responded_at", { ascending: false });

        if (assignmentsError) {
          throw new Error(assignmentsError.message);
        }

        const normalizedRows = (assignments ?? []) as AssignmentRow[];
        if (mounted) {
          setRows(normalizedRows);
        }

        if (normalizedRows.length > 0) {
          const assignmentIds = normalizedRows.map((row) => row.id);
          const { data: ratingRows, error: ratingsError } = await supabase
            .from("ratings")
            .select("assignment_id,score,note")
            .in("assignment_id", assignmentIds);

          if (!ratingsError && mounted) {
            const map: Record<string, RatingRow> = {};
            for (const item of (ratingRows ?? []) as RatingRow[]) {
              map[item.assignment_id] = item;
            }
            setRatings(map);
          }
        }
      } catch (runError) {
        if (mounted) {
          setError(runError instanceof Error ? runError.message : "Failed to load worker history.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main>
      <h1>Worker History</h1>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && rows.length === 0 ? <p>No history found.</p> : null}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <p>{row.jobs?.title ?? "Untitled job"}</p>
            <p>
              {row.jobs?.work_date ?? "-"} {row.jobs?.start_time ?? "-"} - {row.jobs?.end_time ?? "-"}
            </p>
            <p>Status: {row.status}</p>
            {row.completed_at ? <p>Completed: {row.completed_at}</p> : null}
            {ratings[row.id] ? (
              <p>
                Rating: {ratings[row.id].score ?? "-"} {ratings[row.id].note ? `(${ratings[row.id].note})` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
