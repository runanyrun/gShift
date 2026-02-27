"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/skeleton";

type JobDetail = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  hourly_rate: number | null;
  currency: string | null;
  status: string;
  notes: string | null;
  has_applied: boolean;
  application_status: string | null;
};

function fmtDate(value: string) {
  return new Date(value).toLocaleString();
}

export function WorkerJobDetailPage({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [applying, setApplying] = useState(false);

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const body = (await response.json()) as { ok: boolean; data?: T; error?: string };
    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? `Request failed: ${response.status}`);
    }
    return body.data as T;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const row = await fetchJson<JobDetail>(`/api/jobs/${jobId}`);
      setJob(row);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load job.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function applyNow() {
    setApplying(true);
    setError(null);
    try {
      await fetchJson(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Failed to apply.");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <PageHeader title="Job detail" description="Review shift details and submit your application." />
        <Skeleton className="h-48 w-full" />
      </section>
    );
  }

  if (!job) {
    return <p className="text-sm text-slate-600">Job not found.</p>;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={job.title}
        description="Review details and apply."
        actions={(
          <Link
            href="/jobs"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            Back to jobs
          </Link>
        )}
      />

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Shift details</span>
            <Badge variant="outline">{job.status}</Badge>
            {job.application_status ? <Badge variant="secondary">{job.application_status}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-slate-700">Start: {fmtDate(job.starts_at)}</p>
          <p className="text-sm text-slate-700">End: {fmtDate(job.ends_at)}</p>
          <p className="text-sm text-slate-700">
            Pay: {job.currency ?? "USD"} {job.hourly_rate ?? 0}
          </p>
          <p className="text-sm text-slate-700">Notes: {job.notes ?? "No additional notes."}</p>
          <div className="pt-2">
            <Button type="button" onClick={() => void applyNow()} disabled={Boolean(job.has_applied || applying)}>
              {job.has_applied ? "Already applied" : applying ? "Applying..." : "Apply now"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
