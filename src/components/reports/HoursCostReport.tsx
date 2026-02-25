"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_FORMAT, makeFormatters } from "../../lib/format";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type Location = {
  id: string;
  name: string;
};

type ReportTotals = {
  total_hours: number;
  total_cost: number;
};

type EmployeeRow = {
  employee_id: string;
  full_name: string;
  total_hours: number;
  total_cost: number;
};

type LocationRow = {
  location_id: string;
  name: string;
  total_hours: number;
  total_cost: number;
};

type HoursCostReportPayload = {
  from: string;
  to: string;
  location_id: string | null;
  totals: ReportTotals;
  per_employee: EmployeeRow[];
  per_location: LocationRow[];
};

const { formatNumber, formatCurrency, toCsvNumber } = makeFormatters(DEFAULT_FORMAT);

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDateOnly(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function defaultFromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return toDateOnly(date);
}

function defaultToDate() {
  return toDateOnly(new Date());
}

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const lines: string[] = [];
  lines.push(headers.map((header) => csvEscape(header)).join(";"));
  for (const row of rows) {
    lines.push(row.map((cell) => csvEscape(cell)).join(";"));
  }

  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function HoursCostReport() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [locationId, setLocationId] = useState<string>("");

  const [report, setReport] = useState<HoursCostReportPayload | null>(null);

  const isRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);

  async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: "no-store" });
    const body = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? `Request failed: ${response.status}`);
    }
    return body.data as T;
  }

  async function runReport() {
    if (isRangeInvalid) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });
      if (locationId) {
        params.set("locationId", locationId);
      }

      const data = await fetchJson<HoursCostReportPayload>(`/api/reports/hours-cost?${params.toString()}`);
      setReport(data);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Failed to run report");
    } finally {
      setLoading(false);
    }
  }

  async function loadLocations() {
    setBootLoading(true);
    setError(null);
    try {
      const rows = await fetchJson<Location[]>("/api/locations");
      setLocations(rows);
      await runReport();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load locations");
    } finally {
      setBootLoading(false);
    }
  }

  function onExportEmployeesCsv() {
    const rows = report?.per_employee ?? [];
    if (rows.length === 0) {
      return;
    }

    downloadCsv(
      `employees-hours-cost-${fromDate}-to-${toDate}.csv`,
      ["Employee", "Total Hours", "Total Cost"],
      rows.map((row) => [row.full_name, toCsvNumber(row.total_hours), toCsvNumber(row.total_cost)]),
    );
  }

  function onExportLocationsCsv() {
    const rows = report?.per_location ?? [];
    if (rows.length === 0) {
      return;
    }

    downloadCsv(
      `locations-hours-cost-${fromDate}-to-${toDate}.csv`,
      ["Location", "Total Hours", "Total Cost"],
      rows.map((row) => [row.name, toCsvNumber(row.total_hours), toCsvNumber(row.total_cost)]),
    );
  }

  useEffect(() => {
    void loadLocations();
  }, []);

  const totals = useMemo<ReportTotals>(() => {
    if (!report) {
      return { total_hours: 0, total_cost: 0 };
    }
    return report.totals ?? { total_hours: 0, total_cost: 0 };
  }, [report]);

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="from-date">From</Label>
            <Input id="from-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="to-date">To</Label>
            <Input id="to-date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="location">Location</Label>
            <Select id="location" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Button
              type="button"
              onClick={() => void runReport()}
              disabled={loading || bootLoading || !fromDate || !toDate || isRangeInvalid}
              className="min-w-[120px]"
            >
              {loading ? "Running..." : "Run report"}
            </Button>
            <p className={`min-h-[16px] text-xs ${isRangeInvalid ? "text-red-600" : "text-transparent"}`}>
              {isRangeInvalid ? "From date cannot be after To date" : ""}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onExportEmployeesCsv}
            disabled={!report || (report.per_employee ?? []).length === 0}
          >
            Export employees CSV
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onExportLocationsCsv}
            disabled={!report || (report.per_location ?? []).length === 0}
          >
            Export locations CSV
          </Button>
        </div>
      </header>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {bootLoading ? <p className="text-sm text-slate-600">Loading report...</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Total hours</p>
          <p className="text-2xl font-semibold text-slate-900">{formatNumber(totals.total_hours)}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Total cost</p>
          <p className="text-2xl font-semibold text-slate-900">{formatCurrency(totals.total_cost)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Per employee</h2>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Total hours</th>
                <th className="px-4 py-2 font-medium">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {(report?.per_employee ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-slate-500">
                    No data
                  </td>
                </tr>
              ) : (
                report?.per_employee.map((row) => (
                  <tr key={row.employee_id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-900">{row.full_name}</td>
                    <td className="px-4 py-2 text-slate-700">{formatNumber(row.total_hours)}</td>
                    <td className="px-4 py-2 text-slate-700">{formatCurrency(row.total_cost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Per location</h2>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium">Total hours</th>
                <th className="px-4 py-2 font-medium">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {(report?.per_location ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-slate-500">
                    No data
                  </td>
                </tr>
              ) : (
                report?.per_location.map((row) => (
                  <tr key={row.location_id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-900">{row.name}</td>
                    <td className="px-4 py-2 text-slate-700">{formatNumber(row.total_hours)}</td>
                    <td className="px-4 py-2 text-slate-700">{formatCurrency(row.total_cost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
