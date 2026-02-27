"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "../ui/sonner";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Badge } from "../ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { PageHeader } from "../layout/PageHeader";

type JobListItem = {
  id: string;
  location_id: string | null;
  role_id: string | null;
  starts_at: string;
  ends_at: string;
  hourly_rate: number;
  currency: string;
  status: "draft" | "open" | "closed" | "cancelled" | "assigned";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  applicants_count: number;
  assignments_count: number;
  active_assignments_count: number;
};

type LocationItem = {
  id: string;
  name: string;
  timezone: string;
};

type RoleItem = {
  id: string;
  name: string;
  hourly_wage_default: number | null;
};

type CompanySettings = {
  default_shift_start?: string;
  default_shift_end?: string;
  currency?: string;
};

const createSchema = z.object({
  location_id: z.string().uuid("Location is required."),
  role_id: z.string().uuid("Role is required."),
  work_date: z.string().min(1, "Date is required."),
  start_time: z.string().min(1, "Start time is required."),
  end_time: z.string().min(1, "End time is required."),
  hourly_rate: z.coerce.number().min(0),
  currency: z.string().trim().min(3).max(3),
  notes: z.string().optional(),
  title: z.string().trim().max(140).optional(),
});

type CreateValues = z.infer<typeof createSchema>;

const pad2 = (value: number) => String(value).padStart(2, "0");

function getTimeZoneParts(date: Date, timeZone: string) {
  const fallback = {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(date);

    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    const day = Number(parts.find((part) => part.type === "day")?.value);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);

    if ([year, month, day, hour, minute].some((value) => !Number.isFinite(value))) {
      return fallback;
    }

    return { year, month, day, hour, minute };
  } catch {
    return fallback;
  }
}

function makeIsoWithZone(day: string, hour: number, minute: number, timeZone: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const targetWallClockUtc = Date.UTC(year, month - 1, date, hour, minute, 0, 0);
  let candidate = new Date(targetWallClockUtc);

  for (let index = 0; index < 8; index += 1) {
    const zoned = getTimeZoneParts(candidate, timeZone);
    const zonedWallClockUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, 0, 0);
    const diffMinutes = Math.round((targetWallClockUtc - zonedWallClockUtc) / 60000);
    if (diffMinutes === 0) {
      return candidate.toISOString();
    }
    candidate = new Date(candidate.getTime() + diffMinutes * 60000);
  }

  return candidate.toISOString();
}

function statusBadgeVariant(status: JobListItem["status"]): "default" | "secondary" | "outline" | "destructive" {
  if (status === "open") {
    return "default";
  }
  if (status === "closed") {
    return "secondary";
  }
  if (status === "cancelled") {
    return "destructive";
  }
  return "outline";
}

function formatRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleString()} - ${end.toLocaleTimeString()}`;
}

export function ManagerJobsPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [status, setStatus] = useState<"open" | "closed" | "cancelled" | "all">("open");
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      location_id: "",
      role_id: "",
      work_date: "",
      start_time: "09:00",
      end_time: "17:00",
      hourly_rate: 0,
      currency: "USD",
      notes: "",
      title: "",
    },
  });

  const selectedLocationId = form.watch("location_id");
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const selectedRoleId = form.watch("role_id");

  useEffect(() => {
    const role = roles.find((entry) => entry.id === selectedRoleId);
    if (role?.hourly_wage_default !== null && role?.hourly_wage_default !== undefined) {
      form.setValue("hourly_rate", role.hourly_wage_default, { shouldDirty: true });
    }
  }, [form, roles, selectedRoleId]);

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

  async function loadBootstrap() {
    setLoading(true);
    try {
      const [jobsData, roleData, locationData, companySettings] = await Promise.all([
        fetchJson<JobListItem[]>(`/api/manager/jobs?status=${status}`),
        fetchJson<RoleItem[]>("/api/roles"),
        fetchJson<LocationItem[]>("/api/locations"),
        fetchJson<CompanySettings>("/api/company/settings"),
      ]);
      setJobs(jobsData);
      setRoles(roleData);
      setLocations(locationData);
      const defaultCurrency = companySettings.currency ?? "USD";
      form.setValue("currency", defaultCurrency, { shouldDirty: false });
      form.setValue("start_time", companySettings.default_shift_start ?? "09:00", { shouldDirty: false });
      form.setValue("end_time", companySettings.default_shift_end ?? "17:00", { shouldDirty: false });
      if (!form.getValues("location_id") && locationData[0]?.id) {
        form.setValue("location_id", locationData[0].id, { shouldDirty: false });
      }
      if (!form.getValues("role_id") && roleData[0]?.id) {
        form.setValue("role_id", roleData[0].id, { shouldDirty: false });
      }
    } catch (error) {
      toast({ title: "Failed to load manager jobs", description: error instanceof Error ? error.message : "Unexpected error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function onSubmit(values: CreateValues) {
    if (!selectedLocation) {
      toast({ title: "Location required", description: "Select a location before creating a job." });
      return;
    }

    const [startHourRaw, startMinuteRaw] = values.start_time.split(":");
    const [endHourRaw, endMinuteRaw] = values.end_time.split(":");
    const startHour = Number(startHourRaw);
    const startMinute = Number(startMinuteRaw);
    const endHour = Number(endHourRaw);
    const endMinute = Number(endMinuteRaw);

    const startAt = makeIsoWithZone(values.work_date, startHour, startMinute, selectedLocation.timezone);
    const endAt = makeIsoWithZone(values.work_date, endHour, endMinute, selectedLocation.timezone);
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      toast({ title: "Invalid time range", description: "End time must be after start time." });
      return;
    }

    setSubmitting(true);
    try {
      await fetchJson<JobListItem>("/api/manager/jobs", {
        method: "POST",
        body: JSON.stringify({
          location_id: values.location_id,
          role_id: values.role_id,
          start_at: startAt,
          end_at: endAt,
          hourly_rate: values.hourly_rate,
          currency: values.currency,
          notes: values.notes || null,
          title: values.title || null,
        }),
      });
      toast("Job created");
      form.reset({
        ...values,
        notes: "",
        title: "",
      });
      await loadBootstrap();
    } catch (error) {
      toast({ title: "Create failed", description: error instanceof Error ? error.message : "Unexpected error" });
    } finally {
      setSubmitting(false);
    }
  }

  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations]);
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Manager Jobs"
        description="Create and manage operational job lifecycle with audit trail and assignment-safe transitions."
      />

      <Card>
        <CardHeader>
          <CardTitle>New Job</CardTitle>
          <CardDescription>Create an open job posting using location timezone defaults.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
            <div className="space-y-1">
              <Label htmlFor="create-location">Location</Label>
              <Select id="create-location" {...form.register("location_id")}>
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.timezone})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="create-role">Role</Label>
              <Select id="create-role" {...form.register("role_id")}>
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="create-date">Work date</Label>
              <Input id="create-date" type="date" {...form.register("work_date")} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="create-start">Start</Label>
              <Input id="create-start" type="time" {...form.register("start_time")} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="create-end">End</Label>
              <Input id="create-end" type="time" {...form.register("end_time")} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="create-rate">Hourly rate</Label>
              <Input id="create-rate" type="number" min={0} step="0.01" {...form.register("hourly_rate")} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="create-currency">Currency</Label>
              <Input id="create-currency" maxLength={3} {...form.register("currency")} />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="create-title">Title (optional)</Label>
              <Input id="create-title" placeholder="Morning shift - Front desk" {...form.register("title")} />
            </div>

            <div className="space-y-1 md:col-span-3">
              <Label htmlFor="create-notes">Notes (optional)</Label>
              <textarea
                id="create-notes"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                {...form.register("notes")}
              />
            </div>

            <div className="md:col-span-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Job"}
              </Button>
            </div>

            {Object.keys(form.formState.errors).length > 0 ? (
              <p className="md:col-span-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {Object.values(form.formState.errors)[0]?.message?.toString() ?? "Please fix invalid fields."}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>Jobs</CardTitle>
            <Badge variant="outline">{jobs.length} total</Badge>
          </div>
          <Tabs value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="px-6 py-8 text-sm text-slate-600">Loading jobs...</p> : null}
          {!loading && jobs.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-600">No jobs in this status yet.</p>
          ) : null}
          {!loading && jobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Pay</TableHead>
                  <TableHead>Stats</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(job.status)}>{job.status}</Badge>
                    </TableCell>
                    <TableCell>{job.location_id ? (locationById.get(job.location_id) ?? job.location_id) : "-"}</TableCell>
                    <TableCell>{job.role_id ? (roleById.get(job.role_id) ?? job.role_id) : "-"}</TableCell>
                    <TableCell>{formatRange(job.starts_at, job.ends_at)}</TableCell>
                    <TableCell>
                      {job.currency} {job.hourly_rate}
                    </TableCell>
                    <TableCell>
                      {job.applicants_count} apps / {job.active_assignments_count} active
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/manager/jobs/${job.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
