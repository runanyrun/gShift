"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "../ui/sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { PageHeader } from "../layout/PageHeader";

type JobDetail = {
  id: string;
  location_id: string | null;
  role_id: string | null;
  starts_at: string;
  ends_at: string;
  hourly_rate: number;
  currency: string;
  status: "draft" | "open" | "closed" | "cancelled" | "assigned";
  notes: string | null;
  applicants_count: number;
  assignments_count: number;
  active_assignments_count: number;
  events: Array<{
    id: string;
    event_type:
      | "created"
      | "edited"
      | "closed"
      | "cancelled"
      | "reopened"
      | "applied"
      | "invited"
      | "applicant_rejected"
      | "invite_accepted"
      | "invite_rejected";
    actor_user_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
};

type ApplicantRow = {
  application_id: string;
  worker_id: string | null;
  worker_user_id: string;
  worker_name: string;
  worker_email: string;
  status: string;
  note: string | null;
  created_at: string;
  invitation_id: string | null;
  invitation_status: string | null;
  invited_at: string | null;
  responded_at: string | null;
};

type LocationItem = {
  id: string;
  name: string;
  timezone: string;
};

type RoleItem = {
  id: string;
  name: string;
};

const editSchema = z.object({
  location_id: z.string().uuid(),
  role_id: z.string().uuid(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  hourly_rate: z.coerce.number().min(0),
  currency: z.string().trim().min(3).max(3),
  notes: z.string().optional().nullable(),
});

function statusBadgeVariant(status: JobDetail["status"]): "default" | "secondary" | "outline" | "destructive" {
  if (status === "open") return "default";
  if (status === "closed") return "secondary";
  if (status === "cancelled") return "destructive";
  return "outline";
}

function prettyDate(value: string) {
  return new Date(value).toLocaleString();
}

export function ManagerJobDetailPage({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [applicantActionId, setApplicantActionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    location_id: "",
    role_id: "",
    start_at: "",
    end_at: "",
    hourly_rate: "0",
    currency: "USD",
    notes: "",
  });

  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations]);
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);

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

  function syncEditState(nextJob: JobDetail) {
    setEditForm({
      location_id: nextJob.location_id ?? "",
      role_id: nextJob.role_id ?? "",
      start_at: new Date(nextJob.starts_at).toISOString(),
      end_at: new Date(nextJob.ends_at).toISOString(),
      hourly_rate: String(nextJob.hourly_rate),
      currency: nextJob.currency,
      notes: nextJob.notes ?? "",
    });
  }

  async function load() {
    setLoading(true);
    try {
      const [detail, locationRows, roleRows] = await Promise.all([
        fetchJson<JobDetail>(`/api/manager/jobs/${jobId}`),
        fetchJson<LocationItem[]>("/api/locations"),
        fetchJson<RoleItem[]>("/api/roles"),
      ]);
      setJob(detail);
      setLocations(locationRows);
      setRoles(roleRows);
      syncEditState(detail);
      await loadApplicants();
    } catch (error) {
      toast({ title: "Failed to load job", description: error instanceof Error ? error.message : "Unexpected error" });
    } finally {
      setLoading(false);
    }
  }

  async function loadApplicants() {
    setApplicantsLoading(true);
    try {
      const rows = await fetchJson<ApplicantRow[]>(`/api/manager/jobs/${jobId}/applicants`);
      setApplicants(rows);
    } catch (error) {
      toast({ title: "Failed to load applicants", description: error instanceof Error ? error.message : "Unexpected error" });
    } finally {
      setApplicantsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function onSaveEdit() {
    if (!job) {
      return;
    }

    const parsed = editSchema.safeParse({
      ...editForm,
      hourly_rate: Number(editForm.hourly_rate),
      notes: editForm.notes.trim().length > 0 ? editForm.notes : null,
    });
    if (!parsed.success) {
      toast({ title: "Invalid update", description: parsed.error.issues[0]?.message ?? "Invalid form values." });
      return;
    }

    setSaving(true);
    try {
      await fetchJson<JobDetail>("/api/manager/jobs", {
        method: "PATCH",
        body: JSON.stringify({
          id: job.id,
          patch: parsed.data,
        }),
      });
      toast("Job updated");
      setSheetOpen(false);
      await load();
    } catch (error) {
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Unexpected error" });
    } finally {
      setSaving(false);
    }
  }

  async function onClose() {
    if (!job) {
      return;
    }
    setSaving(true);
    try {
      await fetchJson<JobDetail>(`/api/manager/jobs/${job.id}/close`, {
        method: "POST",
        body: JSON.stringify({ reason: closeReason || null }),
      });
      toast("Job closed");
      setCloseOpen(false);
      setCloseReason("");
      await load();
    } catch (error) {
      toast({ title: "Close failed", description: error instanceof Error ? error.message : "Unexpected error" });
    } finally {
      setSaving(false);
    }
  }

  async function onCancel() {
    if (!job) {
      return;
    }
    if (!cancelReason.trim()) {
      toast({ title: "Cancel reason required" });
      return;
    }

    setSaving(true);
    try {
      await fetchJson<JobDetail>(`/api/manager/jobs/${job.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason }),
      });
      toast("Job cancelled");
      setCancelOpen(false);
      setCancelReason("");
      await load();
    } catch (error) {
      toast({ title: "Cancel failed", description: error instanceof Error ? error.message : "Unexpected error" });
    } finally {
      setSaving(false);
    }
  }

  async function onInviteApplicant(workerId: string) {
    if (!job) return;
    setApplicantActionId(workerId);
    try {
      await fetchJson(`/api/manager/jobs/${job.id}/invite`, {
        method: "POST",
        body: JSON.stringify({ worker_id: workerId }),
      });
      toast("Applicant invited");
      await loadApplicants();
      await load();
    } catch (error) {
      toast({ title: "Invite failed", description: error instanceof Error ? error.message : "Unexpected error" });
    } finally {
      setApplicantActionId(null);
    }
  }

  async function onRejectApplicant(workerId: string) {
    if (!job) return;
    setApplicantActionId(workerId);
    try {
      await fetchJson(`/api/manager/jobs/${job.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ worker_id: workerId }),
      });
      toast("Applicant rejected");
      await loadApplicants();
      await load();
    } catch (error) {
      toast({ title: "Reject failed", description: error instanceof Error ? error.message : "Unexpected error" });
    } finally {
      setApplicantActionId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading manager job...</p>;
  }

  if (!job) {
    return <p className="text-sm text-slate-600">Job not found.</p>;
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Job Detail"
        description="Manage lifecycle transitions and review immutable audit history."
        actions={(
          <>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(true)} disabled={job.status === "cancelled"}>
              Edit
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCloseOpen(true)}
              disabled={job.status !== "open"}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              disabled={job.status === "cancelled"}
            >
              Cancel
            </Button>
            <Link
              href="/manager/jobs"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              Back to list
            </Link>
          </>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Job Snapshot</span>
            <Badge variant={statusBadgeVariant(job.status)}>{job.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <p>Location: {job.location_id ? (locationById.get(job.location_id) ?? job.location_id) : "-"}</p>
          <p>Role: {job.role_id ? (roleById.get(job.role_id) ?? job.role_id) : "-"}</p>
          <p>Start: {prettyDate(job.starts_at)}</p>
          <p>End: {prettyDate(job.ends_at)}</p>
          <p>
            Pay: {job.currency} {job.hourly_rate}
          </p>
          <p>
            Applicants: {job.applicants_count} | Assignments: {job.assignments_count} | Active assignments: {job.active_assignments_count}
          </p>
          <p className="md:col-span-2">Notes: {job.notes ?? "-"}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="applicants">
        <TabsList>
          <TabsTrigger value="applicants">Applicants</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>
        <TabsContent value="applicants">
          <Card>
            <CardHeader>
              <CardTitle>Applicants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {applicantsLoading ? <p className="text-sm text-slate-600">Loading applicants...</p> : null}
              {!applicantsLoading && applicants.length === 0 ? (
                <p className="text-sm text-slate-600">No applicants yet.</p>
              ) : null}
              {applicants.map((row) => (
                <div key={row.application_id} className="rounded-md border border-slate-200 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{row.worker_name}</p>
                    <Badge variant="outline">{row.status}</Badge>
                    {row.invitation_status ? <Badge variant="secondary">{row.invitation_status}</Badge> : null}
                  </div>
                  <p className="text-xs text-slate-500">{row.worker_email}</p>
                  <p className="text-xs text-slate-500">Applied: {prettyDate(row.created_at)}</p>
                  {row.note ? <p className="mt-1 text-sm text-slate-700">{row.note}</p> : null}
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => row.worker_id && void onInviteApplicant(row.worker_id)}
                      disabled={!row.worker_id || row.status === "rejected" || row.status === "accepted" || applicantActionId === row.worker_id}
                    >
                      Invite
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => row.worker_id && void onRejectApplicant(row.worker_id)}
                      disabled={!row.worker_id || row.status === "rejected" || row.status === "accepted" || applicantActionId === row.worker_id}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              {job.events.length === 0 ? (
                <p className="text-sm text-slate-600">No events yet.</p>
              ) : (
                <div className="space-y-3">
                  {job.events.map((event) => (
                    <div key={event.id} className="rounded-md border border-slate-200 p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <Badge variant="outline">{event.event_type}</Badge>
                        <p className="text-xs text-slate-500">{prettyDate(event.created_at)}</p>
                      </div>
                      <p className="mb-1 text-xs text-slate-500">Actor: {event.actor_user_id ?? "-"}</p>
                      <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetHeader>
          <SheetTitle>Edit job</SheetTitle>
          <SheetDescription>
            If this job already has an active assignment, only notes and minor time adjustments are allowed.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="edit-location">Location</Label>
            <Select
              id="edit-location"
              value={editForm.location_id}
              onChange={(event) => setEditForm((current) => ({ ...current, location_id: event.target.value }))}
            >
              <option value="">Select location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-role">Role</Label>
            <Select
              id="edit-role"
              value={editForm.role_id}
              onChange={(event) => setEditForm((current) => ({ ...current, role_id: event.target.value }))}
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-start">Start ISO</Label>
            <Input
              id="edit-start"
              value={editForm.start_at}
              onChange={(event) => setEditForm((current) => ({ ...current, start_at: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-end">End ISO</Label>
            <Input
              id="edit-end"
              value={editForm.end_at}
              onChange={(event) => setEditForm((current) => ({ ...current, end_at: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-hourly">Hourly rate</Label>
            <Input
              id="edit-hourly"
              type="number"
              min={0}
              step="0.01"
              value={editForm.hourly_rate}
              onChange={(event) => setEditForm((current) => ({ ...current, hourly_rate: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-currency">Currency</Label>
            <Input
              id="edit-currency"
              maxLength={3}
              value={editForm.currency}
              onChange={(event) => setEditForm((current) => ({ ...current, currency: event.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <textarea
              id="edit-notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={4}
              value={editForm.notes}
              onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => setSheetOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void onSaveEdit()}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </SheetFooter>
      </Sheet>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close job?</DialogTitle>
            <DialogDescription>Closing prevents new applications/invites while keeping existing assignments.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="close-reason">Reason (optional)</Label>
            <Input id="close-reason" value={closeReason} onChange={(event) => setCloseReason(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCloseOpen(false)}>
              Keep open
            </Button>
            <Button type="button" disabled={saving} onClick={() => void onClose()}>
              Close job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel job?</DialogTitle>
            <DialogDescription>
              Cancellation is terminal. Active assignments tied to this job will be cancelled and audited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Input
              id="cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Operational reason for cancellation"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCancelOpen(false)}>
              Keep job
            </Button>
            <Button type="button" variant="destructive" disabled={saving} onClick={() => void onCancel()}>
              Cancel job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
