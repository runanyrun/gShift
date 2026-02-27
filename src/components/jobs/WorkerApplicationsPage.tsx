"use client";

import { useEffect, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "../ui/empty-state";
import { PageHeader } from "../layout/PageHeader";
import { Skeleton } from "../ui/skeleton";

type ApplicationRow = {
  application_id: string;
  job_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  application_status: string;
  invited_at: string | null;
  invitation_id: string | null;
  invitation_status: string | null;
  responded_at: string | null;
};

function fmtDate(value: string) {
  return new Date(value).toLocaleString();
}

function badgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "accepted" || status === "active") return "default";
  if (status === "invited" || status === "pending") return "secondary";
  if (status === "rejected" || status === "cancelled") return "destructive";
  return "outline";
}

export function WorkerApplicationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [responding, setResponding] = useState<Record<string, boolean>>({});

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
      const data = await fetchJson<ApplicationRow[]>("/api/worker/applications");
      setRows(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(inviteId: string, decision: "accept" | "reject") {
    setResponding((current) => ({ ...current, [inviteId]: true }));
    setError(null);
    try {
      await fetchJson(`/api/worker/invitations/${inviteId}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      await load();
    } catch (respondError) {
      setError(respondError instanceof Error ? respondError.message : "Failed to respond to invite.");
    } finally {
      setResponding((current) => ({ ...current, [inviteId]: false }));
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="My Applications"
        description="Track application status and respond to invites from managers."
      />

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Apply to open jobs and your application timeline will appear here."
            />
          ) : (
            rows.map((row) => (
              <div key={row.application_id} className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{row.title}</p>
                  <Badge variant={badgeVariant(row.application_status)}>{row.application_status}</Badge>
                  {row.invitation_status ? (
                    <Badge variant={badgeVariant(row.invitation_status)}>{row.invitation_status}</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-slate-600">
                  {fmtDate(row.starts_at)} - {new Date(row.ends_at).toLocaleTimeString()}
                </p>
                {row.invited_at ? <p className="mt-1 text-xs text-slate-500">Invited: {fmtDate(row.invited_at)}</p> : null}
                {row.responded_at ? <p className="mt-1 text-xs text-slate-500">Responded: {fmtDate(row.responded_at)}</p> : null}

                {row.invitation_id && row.invitation_status === "pending" ? (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => void respond(row.invitation_id as string, "accept")}
                      disabled={Boolean(responding[row.invitation_id])}
                    >
                      {responding[row.invitation_id] ? "Saving..." : "Accept invite"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void respond(row.invitation_id as string, "reject")}
                      disabled={Boolean(responding[row.invitation_id])}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
