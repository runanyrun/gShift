"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_FORMAT, makeFormatters, resolveFormatConfig } from "../../lib/format";
import { LimitedModeAlert } from "../common/LimitedModeAlert";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";

type ApiResponse<T> = { ok: boolean; data?: T; error?: string };

type LocationDraft = { name: string; timezone: string };
type RoleDraft = { name: string; hourly_wage_default: string };
type EmployeeDraft = {
  full_name: string;
  location_id: string;
  role_id: string;
  hourly_rate: string;
};

type LocationRow = { id: string; name: string; timezone: string };
type RoleRow = { id: string; name: string; hourly_wage_default: number | null };
type EmployeeRow = { id: string; full_name: string; location_id: string; role_id: string; hourly_rate: number | null };

const STEPS = ["Company", "Locations", "Roles", "Employees", "Schedule"] as const;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function mondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;
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
  const [companyLocale, setCompanyLocale] = useState(DEFAULT_FORMAT.locale);
  const [companyCurrency, setCompanyCurrency] = useState(DEFAULT_FORMAT.currency);
  const [companyTimeZone, setCompanyTimeZone] = useState("Europe/Istanbul");
  const [companyWeekStartsOn, setCompanyWeekStartsOn] = useState<"mon" | "sun">("mon");
  const [companyDefaultShiftStart, setCompanyDefaultShiftStart] = useState("09:00");
  const [companyDefaultShiftEnd, setCompanyDefaultShiftEnd] = useState("17:00");
  const [companyWarning, setCompanyWarning] = useState<string | null>(null);
  const formatConfig = useMemo(
    () => resolveFormatConfig({ locale: companyLocale, currency: companyCurrency }),
    [companyLocale, companyCurrency],
  );
  const { formatCurrency } = useMemo(() => makeFormatters(formatConfig), [formatConfig]);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [companySaved, setCompanySaved] = useState(false);

  const [locations, setLocations] = useState<LocationDraft[]>([{ name: "", timezone: companyTimeZone || "Europe/Istanbul" }]);
  const [locationsSaved, setLocationsSaved] = useState(false);
  const [createdLocations, setCreatedLocations] = useState<LocationRow[]>([]);

  const [roles, setRoles] = useState<RoleDraft[]>([{ name: "", hourly_wage_default: "" }]);
  const [rolesSaved, setRolesSaved] = useState(false);
  const [createdRoles, setCreatedRoles] = useState<RoleRow[]>([]);

  const [employees, setEmployees] = useState<EmployeeDraft[]>([{ full_name: "", location_id: "", role_id: "", hourly_rate: "" }]);
  const [employeesSaved, setEmployeesSaved] = useState(false);
  const [createdEmployees, setCreatedEmployees] = useState<EmployeeRow[]>([]);

  const [weekStart, setWeekStart] = useState(mondayOfCurrentWeek);
  const [scheduleLocationId, setScheduleLocationId] = useState("");
  const [scheduleGenerated, setScheduleGenerated] = useState(false);

  const canNext = useMemo(() => {
    if (step === 0) {
      return companyName.trim().length > 0;
    }

    if (step === 1) {
      return locations.length > 0 && locations.every((item) => item.name.trim().length > 0 && item.timezone.trim().length > 0);
    }

    if (step === 2) {
      return (
        roles.length > 0
        && roles.every((item) => item.name.trim().length > 0 && (item.hourly_wage_default.trim().length === 0 || Number(item.hourly_wage_default) >= 0))
      );
    }

    if (step === 3) {
      return (
        employees.length > 0
        && employees.every(
          (item) =>
            item.full_name.trim().length > 0
            && item.location_id.trim().length > 0
            && item.role_id.trim().length > 0
            && (item.hourly_rate.trim().length === 0 || Number(item.hourly_rate) >= 0),
        )
      );
    }

    return scheduleLocationId.trim().length > 0 && weekStart.trim().length > 0;
  }, [step, companyName, locations, roles, employees, scheduleLocationId, weekStart]);

  function updateLocation(index: number, patch: Partial<LocationDraft>) {
    setLocations((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateRole(index: number, patch: Partial<RoleDraft>) {
    setRoles((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateEmployee(index: number, patch: Partial<EmployeeDraft>) {
    setEmployees((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addLocation() {
    setLocations((current) => [...current, { name: "", timezone: companyTimeZone || "Europe/Istanbul" }]);
  }

  function addRole() {
    setRoles((current) => [...current, { name: "", hourly_wage_default: "" }]);
  }

  function addEmployee() {
    setEmployees((current) => [
      ...current,
      {
        full_name: "",
        location_id: createdLocations[0]?.id ?? "",
        role_id: createdRoles[0]?.id ?? "",
        hourly_rate: "",
      },
    ]);
  }

  async function saveCompany() {
    const data = await fetchJson<{
      id: string;
      name: string;
      locale?: string | null;
      currency?: string | null;
      timezone?: string | null;
      week_starts_on?: "mon" | "sun" | null;
      default_shift_start?: string | null;
      default_shift_end?: string | null;
      warning?: string;
    }>(
      "/api/onboarding/company",
      {
        method: "POST",
        body: JSON.stringify({
          name: companyName.trim(),
          locale: companyLocale,
          currency: companyCurrency,
          timezone: companyTimeZone,
          week_starts_on: companyWeekStartsOn,
          default_shift_start: companyDefaultShiftStart,
          default_shift_end: companyDefaultShiftEnd,
        }),
      },
    );

    setCompanyName(data.name);
    setCompanyLocale(data.locale || companyLocale);
    setCompanyCurrency(data.currency || companyCurrency);
    setCompanyTimeZone(data.timezone || companyTimeZone);
    setCompanyWeekStartsOn(data.week_starts_on === "sun" ? "sun" : "mon");
    setCompanyDefaultShiftStart(data.default_shift_start || companyDefaultShiftStart);
    setCompanyDefaultShiftEnd(data.default_shift_end || companyDefaultShiftEnd);
    setCompanyWarning(data.warning ?? null);
    setCompanySaved(true);
  }

  async function saveLocations() {
    const payload = locations.map((item) => ({ name: item.name.trim(), timezone: item.timezone.trim() || "Europe/Istanbul" }));
    const rows = await fetchJson<LocationRow[]>("/api/onboarding/locations", {
      method: "POST",
      body: JSON.stringify({ locations: payload }),
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
    const payload = roles.map((item) => ({
      name: item.name.trim(),
      hourly_wage_default: item.hourly_wage_default.trim().length > 0 ? Number(item.hourly_wage_default) : null,
    }));

    const rows = await fetchJson<RoleRow[]>("/api/onboarding/roles", {
      method: "POST",
      body: JSON.stringify({ roles: payload }),
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
    const payload = employees.map((item) => ({
      full_name: item.full_name.trim(),
      location_id: item.location_id,
      role_id: item.role_id,
      hourly_rate: item.hourly_rate.trim().length > 0 ? Number(item.hourly_rate) : null,
    }));

    const rows = await fetchJson<EmployeeRow[]>("/api/onboarding/employees", {
      method: "POST",
      body: JSON.stringify({ employees: payload }),
    });

    setCreatedEmployees(rows);
    setEmployeesSaved(true);
  }

  async function generateDemoSchedule() {
    await fetchJson<{ inserted: number; skipped?: boolean }>("/api/onboarding/demo-schedule", {
      method: "POST",
      body: JSON.stringify({ location_id: scheduleLocationId, week_start: weekStart }),
    });
    setScheduleGenerated(true);
  }

  async function onNext() {
    if (!canNext || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (step === 0 && !companySaved) {
        await saveCompany();
      }
      if (step === 1 && !locationsSaved) {
        await saveLocations();
      }
      if (step === 2 && !rolesSaved) {
        await saveRoles();
      }
      if (step === 3 && !employeesSaved) {
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

  async function onGenerateSchedule() {
    if (!canNext || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await generateDemoSchedule();
      router.push("/schedule");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate demo schedule");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">5 dakikada kurulum</h1>
        <div className="grid grid-cols-5 gap-2">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={`rounded-md border px-3 py-2 text-xs font-medium ${
                index === step
                  ? "border-slate-900 bg-slate-900 text-white"
                  : index < step
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {index + 1}. {label}
            </div>
          ))}
        </div>
      </header>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {step === 0 ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                placeholder="Acme Bakery"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label htmlFor="company-locale">Locale</Label>
                <Select id="company-locale" value={companyLocale} onChange={(event) => setCompanyLocale(event.target.value)}>
                  <option value="tr-TR">tr-TR</option>
                  <option value="en-US">en-US</option>
                  <option value="ar-EG">ar-EG</option>
                </Select>
              </div>
              <div>
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
                onChange={(event) => setCompanyTimeZone(event.target.value)}
                placeholder="Europe/Istanbul"
              />
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <Label htmlFor="company-week-starts-on">Week starts on</Label>
                <Select
                  id="company-week-starts-on"
                  value={companyWeekStartsOn}
                  onChange={(event) => setCompanyWeekStartsOn(event.target.value === "sun" ? "sun" : "mon")}
                >
                  <option value="mon">Monday</option>
                  <option value="sun">Sunday</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="company-default-shift-start">Default shift start</Label>
                <Input
                  id="company-default-shift-start"
                  type="time"
                  value={companyDefaultShiftStart}
                  onChange={(event) => setCompanyDefaultShiftStart(event.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="company-default-shift-end">Default shift end</Label>
                <Input
                  id="company-default-shift-end"
                  type="time"
                  value={companyDefaultShiftEnd}
                  onChange={(event) => setCompanyDefaultShiftEnd(event.target.value)}
                />
              </div>
            </div>

            {companyWarning ? <LimitedModeAlert warning={companyWarning} /> : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            {locations.map((location, index) => (
              <div key={`location-${index}`} className="grid gap-2 md:grid-cols-2">
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
                    placeholder="Europe/Istanbul"
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addLocation}>
              Add location
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            {roles.map((role, index) => (
              <div key={`role-${index}`} className="grid gap-2 md:grid-cols-2">
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
                  <Label htmlFor={`role-wage-${index}`}>Hourly wage default</Label>
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
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            {employees.map((employee, index) => (
              <div key={`employee-${index}`} className="grid gap-2 md:grid-cols-4">
                <div>
                  <Label htmlFor={`employee-name-${index}`}>Full name</Label>
                  <Input
                    id={`employee-name-${index}`}
                    value={employee.full_name}
                    onChange={(event) => updateEmployee(index, { full_name: event.target.value })}
                    placeholder="Ayse Yilmaz"
                  />
                </div>

                <div>
                  <Label htmlFor={`employee-location-${index}`}>Location</Label>
                  <Select
                    id={`employee-location-${index}`}
                    value={employee.location_id}
                    onChange={(event) => updateEmployee(index, { location_id: event.target.value })}
                  >
                    <option value="">Select location</option>
                    {createdLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor={`employee-role-${index}`}>Role</Label>
                  <Select
                    id={`employee-role-${index}`}
                    value={employee.role_id}
                    onChange={(event) => updateEmployee(index, { role_id: event.target.value })}
                  >
                    <option value="">Select role</option>
                    {createdRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor={`employee-rate-${index}`}>Hourly rate (optional)</Label>
                  <Input
                    id={`employee-rate-${index}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={employee.hourly_rate}
                    onChange={(event) => updateEmployee(index, { hourly_rate: event.target.value })}
                    placeholder="280"
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addEmployee}>
              Add employee
            </Button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label htmlFor="schedule-location">Location</Label>
                <Select
                  id="schedule-location"
                  value={scheduleLocationId}
                  onChange={(event) => setScheduleLocationId(event.target.value)}
                >
                  <option value="">Select location</option>
                  {createdLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="week-start">Week start</Label>
                <Input id="week-start" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Demo shifts: {createdEmployees.length} employee x 5 day x {companyDefaultShiftStart}-{companyDefaultShiftEnd}
              {createdRoles.length > 0 ? ` (role defaults e.g. ${createdRoles[0].name}: ${formatCurrency(createdRoles[0].hourly_wage_default ?? 0)})` : ""}
            </div>

            <Button type="button" onClick={() => void onGenerateSchedule()} disabled={!canNext || loading || scheduleGenerated}>
              {scheduleGenerated ? "Redirecting..." : loading ? "Generating..." : "Generate demo week and go to Schedule"}
            </Button>
          </div>
        ) : null}
      </div>

      <footer className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || loading}>
          Back
        </Button>

        {step < 4 ? (
          <Button type="button" onClick={() => void onNext()} disabled={!canNext || loading}>
            {loading ? "Saving..." : "Next"}
          </Button>
        ) : null}
      </footer>
    </section>
  );
}
