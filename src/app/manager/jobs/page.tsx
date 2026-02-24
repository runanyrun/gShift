"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { getActiveTenantId } from "../../../lib/tenancy";
import { inviteWorker } from "../../../lib/rpc";

interface JobRow {
  id: string;
  title: string;
  status: string;
}

interface ApplicationRow {
  id: string;
  worker_id: string;
  status: string;
  created_at: string;
}

const createJobSchema = z.object({
  title: z.string().min(1),
  work_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  hourly_rate: z.number().nonnegative(),
  is_public: z.boolean(),
});

export default function ManagerJobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    work_date: "",
    start_time: "",
    end_time: "",
    hourly_rate: "",
    is_public: true,
  });

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);

  async function loadJobs() {
    const tenantId = getActiveTenantId();
    if (!tenantId) {
      setJobs([]);
      setSelectedJobId("");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error: listError } = await supabase
      .from("jobs")
      .select("id,title,status")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (listError) {
      throw new Error(listError.message);
    }

    const rows = (data ?? []) as JobRow[];
    setJobs(rows);
    setSelectedJobId((current) => current || rows[0]?.id || "");
  }

  async function loadApplications(jobId: string) {
    if (!jobId) {
      setApplications([]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error: listError } = await supabase
      .from("job_applications")
      .select("id,worker_id,status,created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (listError) {
      throw new Error(listError.message);
    }

    setApplications((data ?? []) as ApplicationRow[]);
  }

  useEffect(() => {
    let mounted = true;
    loadJobs()
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load manager jobs.");
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
    loadApplications(selectedJobId).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load applications.");
    });
  }, [selectedJobId]);

  useEffect(() => {
    const onActiveTenantChanged = () => {
      void loadJobs().catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load manager jobs.");
      });
    };
    window.addEventListener("active-tenant-changed", onActiveTenantChanged);
    return () => {
      window.removeEventListener("active-tenant-changed", onActiveTenantChanged);
    };
  }, []);

  async function onInvite(jobId: string, workerId: string) {
    setError(null);
    try {
      await inviteWorker(jobId, workerId);
      await loadApplications(jobId);
      alert("Worker invited.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invite worker.";
      setError(message);
      alert(message);
    }
  }

  async function onCreateJob() {
    setError(null);
    const tenantId = getActiveTenantId();
    if (!tenantId) {
      setError("Select active tenant first.");
      return;
    }

    if (form.end_time <= form.start_time) {
      setError("End time must be after start time.");
      return;
    }

    const parsed = createJobSchema.safeParse({
      title: form.title.trim(),
      work_date: form.work_date,
      start_time: form.start_time,
      end_time: form.end_time,
      hourly_rate: Number.parseFloat(form.hourly_rate || "0"),
      is_public: form.is_public,
    });
    if (!parsed.success) {
      setError("Please fill required fields.");
      return;
    }

    setCreating(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Please sign in.");
      }

      const { data, error: insertError } = await supabase
        .from("jobs")
        .insert({
          tenant_id: tenantId,
          title: parsed.data.title,
          description: null,
          work_date: parsed.data.work_date,
          start_time: parsed.data.start_time,
          end_time: parsed.data.end_time,
          hourly_rate: parsed.data.hourly_rate,
          currency: "TRY",
          is_public: parsed.data.is_public,
          status: "open",
          created_by: user.id,
        })
        .select("id,title,status")
        .single();

      if (insertError || !data) {
        const forbidden = insertError?.code === "42501" || insertError?.message.toLowerCase().includes("permission");
        throw new Error(forbidden ? "You do not have permission to create jobs." : insertError?.message ?? "Failed to create job.");
      }

      await loadJobs();
      setSelectedJobId(data.id);
      setForm({
        title: "",
        work_date: "",
        start_time: "",
        end_time: "",
        hourly_rate: "",
        is_public: true,
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create job.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main>
      <h1>Manager Jobs</h1>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error}</p> : null}

      <section>
        <h2>Create Job</h2>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
        <input
          type="date"
          value={form.work_date}
          onChange={(event) => setForm((current) => ({ ...current, work_date: event.target.value }))}
        />
        <input
          type="time"
          value={form.start_time}
          onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
        />
        <input
          type="time"
          value={form.end_time}
          onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
        />
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="Hourly Rate"
          value={form.hourly_rate}
          onChange={(event) => setForm((current) => ({ ...current, hourly_rate: event.target.value }))}
        />
        <label>
          <input
            type="checkbox"
            checked={form.is_public}
            onChange={(event) => setForm((current) => ({ ...current, is_public: event.target.checked }))}
          />{" "}
          Public
        </label>
        <button type="button" onClick={() => void onCreateJob()} disabled={creating}>
          {creating ? "Creating..." : "Create Job"}
        </button>
      </section>

      <section>
        <h2>Tenant Jobs</h2>
        {!getActiveTenantId() ? <p>Select active tenant first.</p> : null}
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              <button type="button" onClick={() => setSelectedJobId(job.id)}>
                {job.title} ({job.status})
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Applications {selectedJob ? `for ${selectedJob.title}` : ""}</h2>
        {selectedJobId && applications.length === 0 ? <p>No applications.</p> : null}
        <ul>
          {applications.map((app) => (
            <li key={app.id}>
              <p>Worker: {app.worker_id}</p>
              <p>
                {app.status} / {app.created_at}
              </p>
              <button type="button" onClick={() => void onInvite(selectedJobId, app.worker_id)}>
                Invite
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
