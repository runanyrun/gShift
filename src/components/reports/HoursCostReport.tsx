"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_FORMAT, makeFormatters, resolveFormatConfig } from "../../lib/format";
import { calcShiftMetrics } from "../../lib/shift-metrics";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type Location = {
  id: string;
  name: string;
  timezone: string;
};

type Employee = {
  id: string;
  full_name: string;
};

type Role = {
  id: string;
  name: string;
};

type Shift = {
  id: string;
  location_id: string;
  employee_id: string;
  role_id: string;
  start_at: string;
  end_at: string;
  break_minutes: number;
  hourly_wage: number;
  notes: string | null;
  status?: "open" | "closed" | "cancelled";
  cancel_reason?: string | null;
};

type CompanySettings = {
  locale?: string;
  currency?: string;
  timezone?: string;
  week_starts_on?: "mon" | "sun";
  weekly_budget_limit?: number | string | null;
};

type EmployeeCostBreakdown = {
  employee_id: string;
  employee_name: string;
  total_hours: number;
  total_cost: number;
  total_minutes: number;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDateOnlyUtc(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function addDaysToDateString(day: string, days: number) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date));
  next.setUTCDate(next.getUTCDate() + days);
  return toDateOnlyUtc(next);
}

function dateOnlyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function startOfWeekDate(day: string, weekStartsOn: "mon" | "sun") {
  const [year, month, date] = day.split("-").map(Number);
  const current = new Date(Date.UTC(year, month - 1, date));
  const dayIndex = current.getUTCDay();
  const diff = weekStartsOn === "sun" ? -dayIndex : dayIndex === 0 ? -6 : 1 - dayIndex;
  current.setUTCDate(current.getUTCDate() + diff);
  return toDateOnlyUtc(current);
}

function normalizeBudgetLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function dateLabel(day: string, formatDateDisplay: (value: Date | string) => string) {
  const [year, month, date] = day.split("-").map(Number);
  return formatDateDisplay(new Date(Date.UTC(year, month - 1, date, 12, 0, 0)));
}

function budgetStatusText(weekCostTotal: number, weekShiftCount: number, budgetLimit: number | null, formatCurrency: (n: number) => string) {
  if (weekShiftCount === 0) {
    return "No shifts this week";
  }
  if (budgetLimit === null) {
    return "Not set";
  }
  if (budgetLimit <= 0) {
    return "No limit";
  }
  const remaining = budgetLimit - weekCostTotal;
  if (remaining < 0) {
    return `Exceeded ${formatCurrency(Math.abs(remaining))}`;
  }
  return `Remaining ${formatCurrency(remaining)}`;
}

export function HoursCostReport() {
  const router = useRouter();
  const [bootLoading, setBootLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companySettings, setCompanySettings] = useState<Required<CompanySettings>>({
    locale: DEFAULT_FORMAT.locale,
    currency: DEFAULT_FORMAT.currency,
    timezone: "Europe/Istanbul",
    week_starts_on: "mon",
    weekly_budget_limit: null,
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<string>("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: "no-store" });
    const body = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? `Request failed: ${response.status}`);
    }
    return body.data as T;
  }

  const formatConfig = useMemo(
    () =>
      resolveFormatConfig({
        locale: companySettings.locale,
        currency: companySettings.currency,
        timeZone: companySettings.timezone,
      }),
    [companySettings.currency, companySettings.locale, companySettings.timezone],
  );
  const { formatCurrency, formatNumber, formatDateDisplay, formatTimeHM } = useMemo(() => makeFormatters(formatConfig), [formatConfig]);

  async function loadSummaryData(locationId: string, currentWeekStart: string) {
    if (!currentWeekStart) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const targetLocations = locationId ? locations.filter((location) => location.id === locationId) : locations;
      if (targetLocations.length === 0) {
        setShifts([]);
        return;
      }
      const rows = await Promise.all(
        targetLocations.map((location) =>
          fetchJson<Shift[]>(
            `/api/schedule?locationId=${encodeURIComponent(location.id)}&weekStart=${encodeURIComponent(currentWeekStart)}`,
          )),
      );
      setShifts(rows.flat());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }

  async function loadBaseData() {
    setBootLoading(true);
    setError(null);
    try {
      const [settings, locationRows, employeeRows, roleRows] = await Promise.all([
        fetchJson<CompanySettings>("/api/company/settings"),
        fetchJson<Location[]>("/api/locations"),
        fetchJson<Employee[]>("/api/employees"),
        fetchJson<Role[]>("/api/roles"),
      ]);

      const weekStartsOn = settings.week_starts_on === "sun" ? "sun" : "mon";
      const tz = settings.timezone || "Europe/Istanbul";
      const todayInTz = dateOnlyInTimeZone(new Date(), tz);
      const initialWeekStart = startOfWeekDate(todayInTz, weekStartsOn);

      setCompanySettings({
        locale: settings.locale || DEFAULT_FORMAT.locale,
        currency: settings.currency || DEFAULT_FORMAT.currency,
        timezone: tz,
        week_starts_on: weekStartsOn,
        weekly_budget_limit: normalizeBudgetLimit(settings.weekly_budget_limit),
      });
      setLocations(locationRows);
      setEmployees(employeeRows);
      setRoles(roleRows);
      setSelectedLocationId("");
      setWeekStart(initialWeekStart);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load report base data");
    } finally {
      setBootLoading(false);
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    if (bootLoading || !weekStart) {
      return;
    }
    void loadSummaryData(selectedLocationId, weekStart);
  }, [bootLoading, selectedLocationId, weekStart, locations]);

  const activeShifts = useMemo(() => shifts.filter((shift) => (shift.status ?? "open") !== "cancelled"), [shifts]);

  const weeklyCostBreakdown = useMemo(() => {
    const byEmployee = new Map<string, EmployeeCostBreakdown>();

    for (const shift of activeShifts) {
      const metrics = calcShiftMetrics(shift);
      const current = byEmployee.get(shift.employee_id);
      const employeeName = employees.find((employee) => employee.id === shift.employee_id)?.full_name ?? "Unknown";
      if (current) {
        current.total_hours += metrics.duration_hours;
        current.total_cost += metrics.shift_cost;
        current.total_minutes += metrics.duration_hours * 60;
      } else {
        byEmployee.set(shift.employee_id, {
          employee_id: shift.employee_id,
          employee_name: employeeName,
          total_hours: metrics.duration_hours,
          total_cost: metrics.shift_cost,
          total_minutes: metrics.duration_hours * 60,
        });
      }
    }

    return [...byEmployee.values()].sort((a, b) => {
      if (b.total_cost !== a.total_cost) return b.total_cost - a.total_cost;
      if (b.total_minutes !== a.total_minutes) return b.total_minutes - a.total_minutes;
      return a.employee_name.localeCompare(b.employee_name, "tr-TR");
    });
  }, [activeShifts, employees]);

  const filteredBreakdown = useMemo(() => {
    const search = employeeSearch.trim().toLocaleLowerCase("tr-TR");
    if (!search) {
      return weeklyCostBreakdown;
    }
    return weeklyCostBreakdown.filter((item) => item.employee_name.toLocaleLowerCase("tr-TR").includes(search));
  }, [employeeSearch, weeklyCostBreakdown]);

  const weekCostTotal = useMemo(
    () => activeShifts.reduce((sum, shift) => sum + calcShiftMetrics(shift).shift_cost, 0),
    [activeShifts],
  );
  const totalHours = useMemo(
    () => activeShifts.reduce((sum, shift) => sum + calcShiftMetrics(shift).duration_hours, 0),
    [activeShifts],
  );
  const topContributor = weeklyCostBreakdown[0] ?? null;
  const selectedEmployee = weeklyCostBreakdown.find((row) => row.employee_id === selectedEmployeeId) ?? null;
  const selectedEmployeeShifts = useMemo(
    () =>
      activeShifts
        .filter((shift) => shift.employee_id === selectedEmployeeId)
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [activeShifts, selectedEmployeeId],
  );

  const weekEnd = weekStart ? addDaysToDateString(weekStart, 6) : "";
  const weeklyBudgetLimit = normalizeBudgetLimit(companySettings.weekly_budget_limit);
  const budgetText =
    weeklyBudgetLimit === null
      ? "Not set"
      : weeklyBudgetLimit <= 0
        ? "No limit"
        : formatCurrency(weeklyBudgetLimit);
  const statusText = budgetStatusText(weekCostTotal, activeShifts.length, weeklyBudgetLimit, formatCurrency);
  const setupRequired = !bootLoading && locations.length === 0;

  if (bootLoading) {
    return (
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Card key={idx}>
              <CardHeader>
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {setupRequired ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">Complete setup: Add a location</p>
          <Button variant="outline" onClick={() => router.push("/settings/locations")}>
            Add location
          </Button>
        </div>
      ) : null}

      <header className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="location">Location</Label>
            <Select id="location" value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)}>
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!weekStart}
              onClick={() => setWeekStart(addDaysToDateString(weekStart, -7))}
            >
              Previous
            </Button>
            <p className="min-w-[220px] text-center text-sm font-medium text-slate-700">
              {weekStart && weekEnd ? `${dateLabel(weekStart, formatDateDisplay)} - ${dateLabel(weekEnd, formatDateDisplay)}` : "—"}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={!weekStart}
              onClick={() => setWeekStart(addDaysToDateString(weekStart, 7))}
            >
              Next
            </Button>
          </div>
        </div>
      </header>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This week cost</CardDescription>
            <CardTitle>{formatCurrency(weekCostTotal)}</CardTitle>
            <CardDescription>Based on scheduled shifts for selected location and current week</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total hours</CardDescription>
            <CardTitle>{formatNumber(totalHours)}</CardTitle>
            <CardDescription>Based on scheduled shifts for selected location and current week</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Weekly budget</CardDescription>
            <CardTitle>{budgetText}</CardTitle>
            <CardDescription>Based on scheduled shifts for selected location and current week</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Budget status</CardDescription>
            <CardTitle>{statusText}</CardTitle>
            <CardDescription>Based on scheduled shifts for selected location and current week</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top cost contributor</CardDescription>
            <CardTitle>{topContributor ? formatCurrency(topContributor.total_cost) : "No shifts yet"}</CardTitle>
            <CardDescription>Based on scheduled shifts for selected location and current week</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {topContributor ? <Badge variant="secondary">{topContributor.employee_name}</Badge> : <p className="text-sm text-slate-500">No shifts yet</p>}
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading report data...</div>
      ) : activeShifts.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">No shifts for this week</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Employee cost breakdown</CardTitle>
            <div className="max-w-sm">
              <Input
                placeholder="Search employee"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBreakdown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-slate-500">
                      No employees for this week
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBreakdown.map((row) => (
                    <TableRow
                      key={row.employee_id}
                      className={`cursor-pointer ${selectedEmployeeId === row.employee_id ? "bg-slate-100" : ""}`}
                      onClick={() => setSelectedEmployeeId(row.employee_id)}
                    >
                      <TableCell className="font-medium text-slate-900">{row.employee_name}</TableCell>
                      <TableCell>{formatNumber(row.total_hours)}</TableCell>
                      <TableCell>{formatCurrency(row.total_cost)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Employee detail</CardTitle>
            <CardDescription>{selectedEmployee ? selectedEmployee.employee_name : "Select an employee from table"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedEmployee ? (
              <>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-600">Total hours: {formatNumber(selectedEmployee.total_hours)}</p>
                  <p className="text-sm text-slate-600">Total cost: {formatCurrency(selectedEmployee.total_cost)}</p>
                </div>
                <div className="space-y-2">
                  {selectedEmployeeShifts.length === 0 ? (
                    <p className="text-sm text-slate-500">No shifts for selected employee</p>
                  ) : (
                    selectedEmployeeShifts.map((shift) => {
                      const metrics = calcShiftMetrics(shift);
                      const roleName = roles.find((role) => role.id === shift.role_id)?.name ?? "Role";
                      return (
                        <div key={shift.id} className="rounded-md border border-slate-200 p-2 text-xs">
                          <p className="font-medium text-slate-800">{dateLabel(shift.start_at.slice(0, 10), formatDateDisplay)}</p>
                          <p className="text-slate-600">
                            {formatTimeHM(shift.start_at)} - {formatTimeHM(shift.end_at)}
                          </p>
                          <p className="text-slate-600">{roleName}</p>
                          <p className="font-semibold text-slate-800">{formatCurrency(metrics.shift_cost)}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Select a row to inspect employee shifts and weekly totals.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
