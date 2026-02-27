"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DataTableToolbar } from "../ui/data-table-toolbar";
import { EmptyState } from "../ui/empty-state";
import { PageHeader } from "../layout/PageHeader";
import { Section } from "../ui/section";
import { Skeleton } from "../ui/skeleton";

type JobRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location_id: string | null;
  role_id: string | null;
  hourly_rate: number | null;
  currency: string | null;
  status: string;
  has_applied: boolean;
  application_status: string | null;
};

function formatRange(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return `${start.toLocaleString()} - ${end.toLocaleTimeString()}`;
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "applied" || status === "invited") {
    return "secondary";
  }
  if (status === "accepted") {
    return "default";
  }
  if (status === "rejected" || status === "withdrawn") {
    return "destructive";
  }
  return "outline";
}

export function WorkerJobsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [applying, setApplying] = useState<Record<string, boolean>>({});

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
      const rows = await fetchJson<JobRow[]>(`/api/jobs?search=${encodeURIComponent(search)}`);
      setJobs(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function applyToJob(jobId: string) {
    setApplying((current) => ({ ...current, [jobId]: true }));
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
      setApplying((current) => ({ ...current, [jobId]: false }));
    }
  }

  const openJobsCount = useMemo(() => jobs.length, [jobs]);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Find Jobs"
        description="Browse open jobs in your company and apply directly from one place."
        actions={(
          <Link
            href="/worker/applications"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            My applications
          </Link>
        )}
      />

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Section title="Open roles" description="Primary task: search listings and apply. Details are available on the job page.">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Open roles ({openJobsCount})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTableToolbar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search jobs by title"
            />
            {loading ? (
              <div className="space-y-2 px-4 py-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No open jobs right now"
                  description="When managers open new job postings, they will appear here."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <div key={job.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{job.title}</p>
                      <p className="text-sm text-slate-600">{formatRange(job.starts_at, job.ends_at)}</p>
                      <p className="text-xs text-slate-500">
                        {job.currency ?? "USD"} {job.hourly_rate ?? 0}
                      </p>
                      {job.application_status ? (
                        <Badge variant={statusVariant(job.application_status)}>{job.application_status}</Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        Details
                      </Link>
                      <Button
                        type="button"
                        onClick={() => void applyToJob(job.id)}
                        disabled={Boolean(job.has_applied || applying[job.id])}
                      >
                        {job.has_applied ? "Applied" : applying[job.id] ? "Applying..." : "Apply"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Section>
    </section>
  );
}
