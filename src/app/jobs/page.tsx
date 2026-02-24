"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

interface JobRow {
  id: string;
  title: string;
  work_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: listError } = await supabase
          .from("jobs")
          .select("id,title,work_date,start_time,end_time,status")
          .eq("is_public", true)
          .eq("status", "open")
          .order("work_date", { ascending: true })
          .order("start_time", { ascending: true });

        if (listError) {
          throw new Error(listError.message);
        }
        if (mounted) {
          setJobs((data ?? []) as JobRow[]);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load jobs.");
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

  async function apply(jobId: string) {
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Please sign in to apply.");
      }

      const { error: insertError } = await supabase.from("job_applications").insert({
        job_id: jobId,
        worker_id: user.id,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          setApplied((current) => ({ ...current, [jobId]: true }));
          alert("Already applied.");
          return;
        }
        throw new Error(insertError.message);
      }

      setApplied((current) => ({ ...current, [jobId]: true }));
      alert("Applied successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply.";
      setError(message);
      alert(message);
    }
  }

  return (
    <main>
      <h1>Public Jobs</h1>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && jobs.length === 0 ? <p>No public open jobs.</p> : null}
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            <p>{job.title}</p>
            <p>
              {job.work_date} {job.start_time} - {job.end_time}
            </p>
            <button type="button" onClick={() => void apply(job.id)} disabled={Boolean(applied[job.id])}>
              {applied[job.id] ? "Applied" : "Apply"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
