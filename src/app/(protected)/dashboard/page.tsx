"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolvePostLoginRoute } from "../../../core/auth/post-login-routing";
import { useMe } from "../../../core/auth/useMe";
import { calcShiftMetrics } from "../../../lib/shift-metrics";
import { DEFAULT_FORMAT, makeFormatters, resolveFormatConfig } from "../../../lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";

type ApiResponse<T> = { ok: boolean; data?: T; error?: string };
type Location = { id: string; name: string; timezone: string };
type Employee = { id: string; full_name: string };
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
};
type CompanySettings = {
  locale?: string;
  currency?: string;
  weekly_budget_limit?: number | null;
  week_starts_on?: "mon" | "sun";
};

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

export default function DashboardPage() {
  const router = useRouter();
  const { data: me, loading: meLoading } = useMe();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<Required<CompanySettings>>({
    locale: DEFAULT_FORMAT.locale,
    currency: DEFAULT_FORMAT.currency,
    weekly_budget_limit: null,
    week_starts_on: "mon",
  });
  const [weekCostTotal, setWeekCostTotal] = useState(0);
  const [locationCount, setLocationCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [weekShiftCount, setWeekShiftCount] = useState(0);
  const [topContributor, setTopContributor] = useState<{
    employee_id: string;
    employee_name: string;
    total_cost: number;
    total_minutes: number;
  } | null>(null);

  useEffect(() => {
    if (meLoading || !me) {
      return;
    }

    const target = resolvePostLoginRoute(me);
    if (target !== "/dashboard") {
      router.replace(target);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const settings = await fetchJson<CompanySettings>("/api/company/settings");
        const weekStartsOn = settings.week_starts_on === "sun" ? "sun" : "mon";
        const weekStart = toDateOnly(startOfWeek(new Date(), weekStartsOn));
        const locations = await fetchJson<Location[]>("/api/locations");
        const employees = await fetchJson<Employee[]>("/api/employees");
        const employeeNameById = new Map(employees.map((employee) => [employee.id, employee.full_name]));

        const shiftsByLocation = await Promise.all(
          locations.map((location) =>
            fetchJson<Shift[]>(
              `/api/schedule?locationId=${encodeURIComponent(location.id)}&weekStart=${encodeURIComponent(weekStart)}`,
            )),
        );
        const shifts = shiftsByLocation.flat();

        const total = shifts.reduce((sum, shift) => sum + calcShiftMetrics(shift).shift_cost, 0);
        const byEmployee = new Map<string, { total_cost: number; total_minutes: number; employee_name: string }>();
        for (const shift of shifts) {
          const metrics = calcShiftMetrics(shift);
          const current = byEmployee.get(shift.employee_id) ?? {
            total_cost: 0,
            total_minutes: 0,
            employee_name: employeeNameById.get(shift.employee_id) ?? "Unknown",
          };
          byEmployee.set(shift.employee_id, {
            total_cost: current.total_cost + metrics.shift_cost,
            total_minutes: current.total_minutes + metrics.duration_hours * 60,
            employee_name: current.employee_name,
          });
        }
        const top = [...byEmployee.entries()]
          .map(([employee_id, aggregate]) => ({
            employee_id,
            employee_name: aggregate.employee_name,
            total_cost: aggregate.total_cost,
            total_minutes: aggregate.total_minutes,
          }))
          .sort((a, b) => {
            if (b.total_cost !== a.total_cost) return b.total_cost - a.total_cost;
            if (b.total_minutes !== a.total_minutes) return b.total_minutes - a.total_minutes;
            return a.employee_name.localeCompare(b.employee_name, "tr-TR");
          })[0] ?? null;

        if (!mounted) {
          return;
        }
        setCompanySettings({
          locale: settings.locale ?? DEFAULT_FORMAT.locale,
          currency: settings.currency ?? DEFAULT_FORMAT.currency,
          weekly_budget_limit: settings.weekly_budget_limit ?? null,
          week_starts_on: weekStartsOn,
        });
        setWeekCostTotal(total);
        setLocationCount(locations.length);
        setEmployeeCount(employees.length);
        setWeekShiftCount(shifts.length);
        setTopContributor(top);
      } catch (fetchError) {
        if (!mounted) {
          return;
        }
        const message =
          fetchError instanceof Error ? fetchError.message : "Unexpected dashboard bootstrap error.";
        setError(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [me, meLoading, router]);

  if (meLoading || !me) {
    return <div>Loading dashboard...</div>;
  }

  if (resolvePostLoginRoute(me) !== "/dashboard") {
    return <div>Redirecting...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  const formatConfig = resolveFormatConfig({
    locale: companySettings.locale,
    currency: companySettings.currency,
  });
  const { formatCurrency } = makeFormatters(formatConfig);
  const budget = companySettings.weekly_budget_limit;
  const hasBudget = typeof budget === "number" && Number.isFinite(budget);
  const hasPositiveBudget = hasBudget && (budget as number) > 0;
  const budgetDelta = hasPositiveBudget ? (budget as number) - weekCostTotal : 0;
  const setupRequired = locationCount === 0;

  let budgetStatusText = "Not set";
  if (weekShiftCount === 0) {
    budgetStatusText = "No shifts this week";
  } else if (!hasBudget) {
    budgetStatusText = "Not set";
  } else if (!hasPositiveBudget) {
    budgetStatusText = "No limit";
  } else if (budgetDelta < 0) {
    budgetStatusText = `Exceeded ${formatCurrency(Math.abs(budgetDelta))}`;
  } else {
    budgetStatusText = `Remaining ${formatCurrency(budgetDelta)}`;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/settings/company")}>
            Company Settings
          </Button>
          <Button onClick={() => router.push("/schedule")}>
            Go to Schedule
          </Button>
        </div>
      </div>

      {setupRequired ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">Complete setup: Add a location</p>
          <Button variant="outline" onClick={() => router.push("/settings/locations")}>
            Add location
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This week cost</CardDescription>
            <CardTitle>{setupRequired ? "Setup required" : formatCurrency(weekCostTotal)}</CardTitle>
            <CardDescription>Based on scheduled shifts for selected location and current week</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Weekly budget</CardDescription>
            <CardTitle>
              {setupRequired ? "Setup required" : hasBudget ? formatCurrency(budget as number) : "Not set"}
            </CardTitle>
            <CardDescription>Based on scheduled shifts for selected location and current week</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Budget status</CardDescription>
            <CardTitle>{setupRequired ? "Setup required" : budgetStatusText}</CardTitle>
            <CardDescription>Based on scheduled shifts for selected location and current week</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top cost contributor</CardDescription>
            <CardTitle>
              {setupRequired
                ? "Setup required"
                : employeeCount === 0
                  ? "—"
                  : topContributor
                    ? formatCurrency(topContributor.total_cost)
                    : "No shifts yet"}
            </CardTitle>
            <CardDescription>Based on scheduled shifts for selected location and current week</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {setupRequired ? (
              <p className="text-sm text-slate-500">Add at least one location to start tracking costs.</p>
            ) : employeeCount === 0 ? (
              <p className="text-sm text-slate-500">No employees yet</p>
            ) : topContributor ? (
              <Badge variant="secondary">{topContributor.employee_name}</Badge>
            ) : (
              <p className="text-sm text-slate-500">No shifts yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
