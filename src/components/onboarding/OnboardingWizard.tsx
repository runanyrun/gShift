"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "../../core/auth/useMe";
import { resolvePostLoginRoute } from "../../core/auth/post-login-routing";
import { LimitedModeAlert } from "../common/LimitedModeAlert";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "../ui/empty-state";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { PageHeader } from "../layout/PageHeader";
import { Section } from "../ui/section";
import { WorkDaysPicker } from "../ui/work-days-picker";
import { type DayKey, readSchedulePrefs, writeSchedulePrefs } from "../../lib/schedule-prefs";

type ApiResponse<T> = { ok: boolean; data?: T; error?: string };

type LocationDraft = { name: string; timezone: string };
type RoleDraft = { name: string; hourly_wage_default: string };
type EmployeeDraft = {
  full_name: string;
  location_id: string;
  role_id: string;
  email: string;
  portal_access_enabled: boolean;
  additional_roles: string;
  availability_days: DayKey[];
  pay_mode: "hourly" | "daily" | "salary";
  pay_amount: string;
};

type LocationRow = { id: string; name: string; timezone: string };
type RoleRow = { id: string; name: string; hourly_wage_default: number | null };
type EmployeeRow = { id: string; full_name: string; location_id: string; role_id: string; hourly_rate: number | null };

const STEPS = ["Company", "Locations", "Roles", "Employees", "Schedule"] as const;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDateOnly(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfWeek(base: Date, weekStartsOn: "mon" | "sun") {
  const date = new Date(base);
  const day = date.getDay();
  const diff = weekStartsOn === "sun" ? -day : day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function mondayOfCurrentWeek() {
  return toDateOnly(startOfWeek(new Date(), "mon"));
}

function parseTime(value: string, fallback: string) {
  const [hourRaw, minuteRaw] = (value || fallback).split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    const [fallbackHour, fallbackMinute] = fallback.split(":").map(Number);
    return { hour: fallbackHour, minute: fallbackMinute };
  }

  return { hour, minute };
}

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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }

  return body.data as T;
}

export function OnboardingWizard() {
  const router = useRouter();
  const { data: me } = useMe();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState("/dashboard");

  const [companyName, setCompanyName] = useState("");
  const [companyLocale, setCompanyLocale] = useState("tr-TR");
  const [companyCurrency, setCompanyCurrency] = useState("TRY");
  const [companyTimeZone, setCompanyTimeZone] = useState("Europe/Istanbul");
  const [companyWarning, setCompanyWarning] = useState<string | null>(null);
  const [companySaved, setCompanySaved] = useState(false);

  const [locations, setLocations] = useState<LocationDraft[]>([{ name: "", timezone: "Europe/Istanbul" }]);
  const [locationsSaved, setLocationsSaved] = useState(false);
  const [createdLocations, setCreatedLocations] = useState<LocationRow[]>([]);

  const [roles, setRoles] = useState<RoleDraft[]>([{ name: "", hourly_wage_default: "" }]);
  const [rolesSaved, setRolesSaved] = useState(false);
  const [createdRoles, setCreatedRoles] = useState<RoleRow[]>([]);
  const [departmentNote, setDepartmentNote] = useState("");

  const [employees, setEmployees] = useState<EmployeeDraft[]>([{
    full_name: "",
    location_id: "",
    role_id: "",
    email: "",
    portal_access_enabled: false,
    additional_roles: "",
    availability_days: readSchedulePrefs().workingDays,
    pay_mode: "hourly",
    pay_amount: "",
  }]);
  const [employeesSaved, setEmployeesSaved] = useState(false);
  const [createdEmployees, setCreatedEmployees] = useState<EmployeeRow[]>([]);

  const [scheduleWeekStartsOn, setScheduleWeekStartsOn] = useState<"mon" | "sun">("mon");
  const [scheduleDefaultShiftStart, setScheduleDefaultShiftStart] = useState("09:00");
  const [scheduleDefaultShiftEnd, setScheduleDefaultShiftEnd] = useState("17:00");
  const [scheduleWorkingDays, setScheduleWorkingDays] = useState<DayKey[]>(readSchedulePrefs().workingDays);
  const [weekStart, setWeekStart] = useState(mondayOfCurrentWeek);
  const [scheduleLocationId, setScheduleLocationId] = useState("");

  useEffect(() => {
    if (!completed) {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.replace(redirectTarget);
    }, 1800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [completed, redirectTarget, router]);

  const unlockedStep = useMemo(() => {
    if (!companySaved) return 0;
    if (!locationsSaved) return 1;
    if (!rolesSaved) return 2;
    if (!employeesSaved) return 3;
    return 4;
  }, [companySaved, locationsSaved, rolesSaved, employeesSaved]);

  const canNext = useMemo(() => {
    if (step === 0) {
      return companyName.trim().length > 0 && companyTimeZone.trim().length > 0;
    }

    if (step === 1) {
      return locations.length > 0 && locations.every((item) => item.name.trim() && item.timezone.trim());
    }

    if (step === 2) {
      return roles.length > 0 && roles.every((item) => item.name.trim().length > 0);
    }

    if (step === 3) {
      return (
        createdLocations.length > 0
        && createdRoles.length > 0
        && employees.length > 0
        && employees.every((item) =>
          item.full_name.trim().length > 0
          && item.location_id.trim().length > 0
          && item.role_id.trim().length > 0
          && (!item.portal_access_enabled || item.email.trim().length > 0),
        )
      );
    }

    return (
      scheduleLocationId.trim().length > 0
      && weekStart.trim().length > 0
      && scheduleDefaultShiftStart.trim().length > 0
      && scheduleDefaultShiftEnd.trim().length > 0
      && scheduleWorkingDays.length > 0
    );
  }, [
    step,
    companyName,
    companyTimeZone,
    locations,
    roles,
    employees,
    createdLocations.length,
    createdRoles.length,
    scheduleLocationId,
    weekStart,
    scheduleDefaultShiftStart,
    scheduleDefaultShiftEnd,
    scheduleWorkingDays,
  ]);

  function updateLocation(index: number, patch: Partial<LocationDraft>) {
    setLocationsSaved(false);
    setLocations((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateRole(index: number, patch: Partial<RoleDraft>) {
    setRolesSaved(false);
    setRoles((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateEmployee(index: number, patch: Partial<EmployeeDraft>) {
    setEmployeesSaved(false);
    setEmployees((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addLocation() {
    setLocationsSaved(false);
    setLocations((current) => [...current, { name: "", timezone: companyTimeZone || "Europe/Istanbul" }]);
  }

  function addRole() {
    setRolesSaved(false);
    setRoles((current) => [...current, { name: "", hourly_wage_default: "" }]);
  }

  function addEmployee() {
    setEmployeesSaved(false);
    setEmployees((current) => [
      ...current,
      {
        full_name: "",
        location_id: createdLocations[0]?.id ?? "",
        role_id: createdRoles[0]?.id ?? "",
        email: "",
        portal_access_enabled: false,
        additional_roles: "",
        availability_days: scheduleWorkingDays,
        pay_mode: "hourly",
        pay_amount: "",
      },
    ]);
  }

  async function saveCompany() {
    const data = await fetchJson<{
      name: string;
      locale?: string | null;
      currency?: string | null;
      timezone?: string | null;
      warning?: string;
    }>("/api/onboarding/company", {
      method: "POST",
      body: JSON.stringify({
        name: companyName.trim(),
        locale: companyLocale,
        currency: companyCurrency,
        timezone: companyTimeZone,
      }),
    });

    setCompanyName(data.name);
    setCompanyLocale(data.locale || companyLocale);
    setCompanyCurrency(data.currency || companyCurrency);
    setCompanyTimeZone(data.timezone || companyTimeZone);
    setCompanyWarning(data.warning ?? null);
    setCompanySaved(true);
  }

  async function saveLocations() {
    const rows = await fetchJson<LocationRow[]>("/api/onboarding/locations", {
      method: "POST",
      body: JSON.stringify({
        locations: locations.map((item) => ({
          name: item.name.trim(),
          timezone: item.timezone.trim() || companyTimeZone || "Europe/Istanbul",
        })),
      }),
    });

    setCreatedLocations(rows);
    setScheduleLocationId(rows[0]?.id ?? "");
    setEmployees((current) =>
      current.map((item) => ({
        ...item,
        location_id: item.location_id || rows[0]?.id || "",
      })),
    );
    setLocationsSaved(true);
  }

  async function saveRoles() {
    const rows = await fetchJson<RoleRow[]>("/api/onboarding/roles", {
      method: "POST",
      body: JSON.stringify({
        roles: roles.map((item) => ({
          name: item.name.trim(),
          hourly_wage_default: item.hourly_wage_default.trim() ? Number(item.hourly_wage_default) : null,
        })),
      }),
    });

    setCreatedRoles(rows);
    setEmployees((current) =>
      current.map((item) => ({
        ...item,
        role_id: item.role_id || rows[0]?.id || "",
      })),
    );
    setRolesSaved(true);
  }

  async function saveEmployees() {
    const rows = await fetchJson<EmployeeRow[]>("/api/onboarding/employees", {
      method: "POST",
      body: JSON.stringify({
        employees: employees.map((item) => ({
          full_name: item.full_name.trim(),
          location_id: item.location_id,
          role_id: item.role_id,
          hourly_rate: item.pay_mode === "hourly" && item.pay_amount.trim() ? Number(item.pay_amount) : null,
        })),
      }),
    });

    setCreatedEmployees(rows);
    setEmployeesSaved(true);
  }

  async function completeScheduleSetup() {
    await fetchJson("/api/company/settings", {
      method: "PATCH",
      body: JSON.stringify({
        week_starts_on: scheduleWeekStartsOn,
        default_shift_start: scheduleDefaultShiftStart,
        default_shift_end: scheduleDefaultShiftEnd,
      }),
    });

    writeSchedulePrefs({ workingDays: scheduleWorkingDays });

    const employee = createdEmployees[0];
    const role = createdRoles.find((item) => item.id === employee?.role_id) ?? createdRoles[0];
    const location = createdLocations.find((item) => item.id === scheduleLocationId) ?? createdLocations[0];

    if (!employee || !role || !location) {
      throw new Error("Complete employees, roles, and locations before creating the first shift.");
    }

    const start = parseTime(scheduleDefaultShiftStart, "09:00");
    const end = parseTime(scheduleDefaultShiftEnd, "17:00");
    const targetDay = toDateOnly(startOfWeek(new Date(weekStart), scheduleWeekStartsOn));

    await fetchJson("/api/shifts/bulk-upsert", {
      method: "POST",
      body: JSON.stringify({
        shifts: [{
          location_id: location.id,
          employee_id: employee.id,
          role_id: role.id,
          start_at: makeIsoWithZone(targetDay, start.hour, start.minute, location.timezone || companyTimeZone),
          end_at: makeIsoWithZone(targetDay, end.hour, end.minute, location.timezone || companyTimeZone),
          break_minutes: 0,
          hourly_wage: employee.hourly_rate ?? role.hourly_wage_default ?? 0,
          notes: "Starter shift",
        }],
      }),
    });
  }

  async function onNext() {
    if (!canNext || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (step === 0) {
        await saveCompany();
      } else if (step === 1) {
        await saveLocations();
      } else if (step === 2) {
        await saveRoles();
      } else if (step === 3) {
        await saveEmployees();
      }

      if (step < 4) {
        setStep((current) => current + 1);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Setup step failed");
    } finally {
      setLoading(false);
    }
  }

  async function finishSetup() {
    if (!canNext || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await completeScheduleSetup();
      const nextRoute = me ? resolvePostLoginRoute(me) : "/dashboard";
      setRedirectTarget(nextRoute === "/onboarding" ? "/dashboard" : nextRoute);
      setCompleted(true);
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Failed to finish setup");
    } finally {
      setLoading(false);
    }
  }

  if (completed) {
    return (
      <section className="space-y-6">
        <PageHeader title="5-minute setup" description="Your workspace now has the basics in place." />
        <EmptyState
          title="You're ready"
          description="Setup is complete. We created a starter shift so the product no longer feels empty."
        />
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => router.push("/schedule")}>Go to Schedule</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="5-step setup"
        description="Finish company setup with one clean flow: company, locations, roles, employees, then schedule preferences."
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            {STEPS.map((label, index) => {
              const isComplete = index < unlockedStep;
              const isActive = index === step;
              const isLocked = index > unlockedStep;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index)}
                  disabled={loading || isLocked}
                  className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : isComplete
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wide opacity-70">Step {index + 1}</span>
                  <span>{label}{isComplete ? " ✓" : ""}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Section
        title={STEPS[step]}
        description={
          step === 0
            ? "Set the company identity and formatting defaults first."
            : step === 1
              ? "Add at least one location so future schedules have a place to live."
              : step === 2
                ? "Create at least one role. Departments stay optional."
                : step === 3
                  ? "Add at least one scheduling-ready employee."
                  : "Finalize schedule preferences and create the first shift."
        }
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{STEPS[step]}</CardTitle>
            <CardDescription>
              {step === 0 ? "Validation: company name, locale, currency, and timezone are required." : null}
              {step === 1 ? "Validation: at least one location with timezone." : null}
              {step === 2 ? "Validation: at least one role. Departments can be skipped safely." : null}
              {step === 3 ? "Validation: employee name, location, role, and email when portal access is enabled." : null}
              {step === 4 ? "Validation: employees and locations must exist before the first shift is created." : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company name</Label>
                  <Input
                    id="company-name"
                    placeholder="Acme Bakery"
                    value={companyName}
                    onChange={(event) => {
                      setCompanySaved(false);
                      setCompanyName(event.target.value);
                    }}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="company-locale">Locale</Label>
                    <Select id="company-locale" value={companyLocale} onChange={(event) => setCompanyLocale(event.target.value)}>
                      <option value="tr-TR">tr-TR</option>
                      <option value="en-US">en-US</option>
                      <option value="ar-EG">ar-EG</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="company-currency">Currency</Label>
                    <Select id="company-currency" value={companyCurrency} onChange={(event) => setCompanyCurrency(event.target.value)}>
                      <option value="TRY">TRY</option>
                      <option value="USD">USD</option>
                      <option value="EGP">EGP</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company-timezone">Timezone</Label>
                  <Input
                    id="company-timezone"
                    value={companyTimeZone}
                    onChange={(event) => {
                      setCompanySaved(false);
                      setCompanyTimeZone(event.target.value);
                    }}
                    placeholder="Europe/Istanbul"
                  />
                </div>

                {companyWarning ? <LimitedModeAlert warning={companyWarning} /> : null}
                {companySaved ? <p className="text-sm text-emerald-700">Company step complete. The next step is unlocked.</p> : null}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-3">
                {locations.map((location, index) => (
                  <div key={`location-${index}`} className="space-y-2 rounded-md border border-slate-200 p-3">
                    <div>
                      <Label htmlFor={`location-name-${index}`}>Location name</Label>
                      <Input
                        id={`location-name-${index}`}
                        value={location.name}
                        onChange={(event) => updateLocation(index, { name: event.target.value })}
                        placeholder={`Location ${index + 1}`}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`location-timezone-${index}`}>Timezone</Label>
                      <Input
                        id={`location-timezone-${index}`}
                        value={location.timezone}
                        onChange={(event) => updateLocation(index, { timezone: event.target.value })}
                        placeholder={companyTimeZone || "Europe/Istanbul"}
                      />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addLocation}>
                  Add location
                </Button>
                {locationsSaved ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {createdLocations.length} location saved. You can continue or come back and edit before moving on.
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3">
                {roles.map((role, index) => (
                  <div key={`role-${index}`} className="space-y-2 rounded-md border border-slate-200 p-3">
                    <div>
                      <Label htmlFor={`role-name-${index}`}>Role name</Label>
                      <Input
                        id={`role-name-${index}`}
                        value={role.name}
                        onChange={(event) => updateRole(index, { name: event.target.value })}
                        placeholder="Cashier"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`role-wage-${index}`}>Default hourly rate (optional)</Label>
                      <Input
                        id={`role-wage-${index}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={role.hourly_wage_default}
                        onChange={(event) => updateRole(index, { hourly_wage_default: event.target.value })}
                        placeholder="250"
                      />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addRole}>
                  Add role
                </Button>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <Label htmlFor="department-note">Departments (optional)</Label>
                  <Input
                    id="department-note"
                    value={departmentNote}
                    onChange={(event) => setDepartmentNote(event.target.value)}
                    placeholder="Optional note, e.g. Front of house"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Departments are safe to skip. Add them later in Settings if you need more detailed grouping.
                  </p>
                </div>

                {rolesSaved ? <p className="text-sm text-emerald-700">Roles step complete. Departments remain optional.</p> : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-3">
                {createdLocations.length === 0 || createdRoles.length === 0 ? (
                  <EmptyState
                    title="Complete locations and roles first"
                    description="Employees need both a location and a role. Go back, save those steps, then return here."
                    actionLabel="Go to Roles"
                    onAction={() => setStep(createdLocations.length === 0 ? 1 : 2)}
                  />
                ) : (
                  <>
                    {employees.map((employee, index) => (
                      <div key={`employee-${index}`} className="space-y-3 rounded-md border border-slate-200 p-3">
                        <div>
                          <Label htmlFor={`employee-name-${index}`}>Full name</Label>
                          <Input
                            id={`employee-name-${index}`}
                            value={employee.full_name}
                            onChange={(event) => updateEmployee(index, { full_name: event.target.value })}
                            placeholder="Alex Morgan"
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={`employee-location-${index}`}>Location</Label>
                            <Select
                              id={`employee-location-${index}`}
                              value={employee.location_id}
                              onChange={(event) => updateEmployee(index, { location_id: event.target.value })}
                            >
                              <option value="">Select location</option>
                              {createdLocations.map((location) => (
                                <option key={location.id} value={location.id}>{location.name}</option>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`employee-role-${index}`}>Primary role</Label>
                            <Select
                              id={`employee-role-${index}`}
                              value={employee.role_id}
                              onChange={(event) => updateEmployee(index, { role_id: event.target.value })}
                            >
                              <option value="">Select role</option>
                              {createdRoles.map((role) => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                              ))}
                            </Select>
                          </div>
                        </div>

                        <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm" htmlFor={`employee-access-${index}`}>
                          <input
                            id={`employee-access-${index}`}
                            type="checkbox"
                            checked={employee.portal_access_enabled}
                            onChange={(event) => updateEmployee(index, { portal_access_enabled: event.target.checked })}
                          />
                          <span className="space-y-1">
                            <span className="block font-medium text-slate-900">Portal access</span>
                            <span className="block text-slate-600">
                              {employee.portal_access_enabled
                                ? "Email is now required so you can invite this employee later."
                                : "This employee can be scheduled but cannot log in yet."}
                            </span>
                          </span>
                        </label>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={`employee-email-${index}`}>Email (optional)</Label>
                            <Input
                              id={`employee-email-${index}`}
                              type="email"
                              value={employee.email}
                              onChange={(event) => updateEmployee(index, { email: event.target.value })}
                              placeholder="alex@company.com"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`employee-additional-roles-${index}`}>Additional roles (optional)</Label>
                            <Input
                              id={`employee-additional-roles-${index}`}
                              value={employee.additional_roles}
                              onChange={(event) => updateEmployee(index, { additional_roles: event.target.value })}
                              placeholder="Opener, closer"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label>Default availability</Label>
                          <WorkDaysPicker
                            value={employee.availability_days}
                            onChange={(availability_days) => updateEmployee(index, { availability_days })}
                            helperText="UI-only for now. This is a planning hint and future-safe for richer availability rules."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Default pay</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { key: "hourly", label: "Hourly rate" },
                              { key: "daily", label: "Daily wage" },
                              { key: "salary", label: "Salary" },
                            ].map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => updateEmployee(index, { pay_mode: option.key as EmployeeDraft["pay_mode"] })}
                                className={`rounded-md border px-3 py-2 text-sm ${
                                  employee.pay_mode === option.key
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-300 bg-white text-slate-700"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={employee.pay_amount}
                            onChange={(event) => updateEmployee(index, { pay_amount: event.target.value })}
                            placeholder={employee.pay_mode === "hourly" ? "Hourly rate" : employee.pay_mode === "daily" ? "Daily wage" : "Salary"}
                          />
                        </div>
                      </div>
                    ))}

                    <Button type="button" variant="outline" onClick={addEmployee}>
                      Add employee
                    </Button>
                    {employeesSaved ? <p className="text-sm text-emerald-700">Employees step complete. The schedule step is ready.</p> : null}
                  </>
                )}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                {createdLocations.length === 0 || createdEmployees.length === 0 ? (
                  <EmptyState
                    title="You need at least one location and one employee"
                    description="Complete the earlier steps first. Schedule setup only unlocks after people and places exist."
                    actionLabel="Go to Employees"
                    onAction={() => setStep(createdLocations.length === 0 ? 1 : 3)}
                  />
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="schedule-location">Starter shift location</Label>
                        <Select id="schedule-location" value={scheduleLocationId} onChange={(event) => setScheduleLocationId(event.target.value)}>
                          {createdLocations.map((location) => (
                            <option key={location.id} value={location.id}>{location.name}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="schedule-week-start">Week of</Label>
                        <Input id="schedule-week-start" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="schedule-week-starts-on">Week starts on</Label>
                        <Select
                          id="schedule-week-starts-on"
                          value={scheduleWeekStartsOn}
                          onChange={(event) => setScheduleWeekStartsOn(event.target.value === "sun" ? "sun" : "mon")}
                        >
                          <option value="mon">Monday</option>
                          <option value="sun">Sunday</option>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="schedule-default-shift-start">Default shift start</Label>
                        <Input
                          id="schedule-default-shift-start"
                          type="time"
                          value={scheduleDefaultShiftStart}
                          onChange={(event) => setScheduleDefaultShiftStart(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="schedule-default-shift-end">Default shift end</Label>
                        <Input
                          id="schedule-default-shift-end"
                          type="time"
                          value={scheduleDefaultShiftEnd}
                          onChange={(event) => setScheduleDefaultShiftEnd(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Working days</Label>
                      <WorkDaysPicker
                        value={scheduleWorkingDays}
                        onChange={setScheduleWorkingDays}
                        helperText="These days will also appear in Company Settings and the schedule grid highlights."
                      />
                    </div>

                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Finish setup creates one starter shift using the first saved employee, selected location, and your default shift time.
                    </div>
                  </>
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {step > 0 ? (
                <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={loading}>
                  Back
                </Button>
              ) : null}

              {step < 4 ? (
                <Button type="button" onClick={() => void onNext()} disabled={!canNext || loading}>
                  {loading ? "Saving..." : "Save and continue"}
                </Button>
              ) : (
                <Button type="button" onClick={() => void finishSetup()} disabled={!canNext || loading}>
                  {loading ? "Finishing..." : "Finish setup"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </Section>
    </section>
  );
}
