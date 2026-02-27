"use client";

import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_FORMAT, makeFormatters, resolveFormatConfig } from "../../lib/format";
import { calcShiftMetrics } from "../../lib/shift-metrics";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";
import { DataTableToolbar } from "../ui/data-table-toolbar";
import { EmptyState } from "../ui/empty-state";
import { Skeleton } from "../ui/skeleton";

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
  location_id: string;
  role_id: string;
  hourly_rate: number | null;
  active: boolean;
};

type Role = {
  id: string;
  name: string;
  hourly_wage_default: number | null;
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
  closed_at?: string | null;
  cancelled_at?: string | null;
};

type CompanySettings = {
  locale?: string;
  currency?: string;
  weekly_budget_limit?: number | string | null;
  week_starts_on?: "mon" | "sun";
  default_shift_start?: string;
  default_shift_end?: string;
};

type ShiftInput = {
  id?: string;
  location_id: string;
  employee_id: string;
  role_id: string;
  start_at: string;
  end_at: string;
  break_minutes?: number;
  hourly_wage: number;
  notes?: string | null;
  status?: "open" | "closed" | "cancelled";
  cancel_reason?: string | null;
};

type EditableShift = {
  id: string;
  location_id: string;
  employee_id: string;
  role_id: string;
  start_at: string;
  end_at: string;
  break_minutes: number;
  hourly_wage: string;
  notes: string;
};

type EmployeeCostBreakdown = {
  employee_id: string;
  employee_name: string;
  total_hours: number;
  total_cost: number;
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDateOnly(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function isTempId(id: string) {
  return id.startsWith("tmp-");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function addDaysToDateString(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date));
  next.setUTCDate(next.getUTCDate() + days);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
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
  const safeHour = Number.isFinite(hour) ? hour : 0;
  const safeMinute = Number.isFinite(minute) ? minute : 0;
  const targetWallClockUtc = Date.UTC(year, month - 1, date, safeHour, safeMinute, 0, 0);
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

function dateOfIsoInTimeZone(iso: string, timeZone: string): string {
  const zoned = getTimeZoneParts(new Date(iso), timeZone);
  return `${zoned.year}-${pad2(zoned.month)}-${pad2(zoned.day)}`;
}

function timeOfIsoInTimeZone(iso: string, timeZone: string): string {
  const zoned = getTimeZoneParts(new Date(iso), timeZone);
  return `${pad2(zoned.hour)}:${pad2(zoned.minute)}`;
}

function startOfWeek(base: Date, weekStartsOn: "mon" | "sun") {
  const date = new Date(base);
  const day = date.getDay();
  const diff = weekStartsOn === "sun" ? -day : day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateOnly(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 0, 0, 0, 0);
}

function parseTimeInput(value: string | undefined, fallbackHour: number, fallbackMinute: number) {
  if (!value) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }

  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }

  return { hour, minute };
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

function buildWeekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysToDateString(weekStart, index));
}

function dateLabel(day: string, timeZone: string, formatDateDisplay: (value: Date | string) => string) {
  const anchor = makeIsoWithZone(day, 12, 0, timeZone);
  const [year, month, date] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return `${DAY_NAMES[(weekday + 6) % 7]} ${formatDateDisplay(anchor)}`;
}

function dateOfIsoLocal(iso: string, timeZone: string) {
  return dateOfIsoInTimeZone(iso, timeZone);
}

function setDateKeepingTime(iso: string, dateOnly: string, timeZone: string) {
  const [hourStr, minuteStr] = timeOfIsoInTimeZone(iso, timeZone).split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  return makeIsoWithZone(dateOnly, Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, timeZone);
}

function fmtTimeRange(startIso: string, endIso: string, formatTimeHM: (value: Date | string) => string) {
  return `${formatTimeHM(startIso)} - ${formatTimeHM(endIso)}`;
}

function statusOfShift(shift: Shift): "open" | "closed" | "cancelled" {
  return shift.status ?? "open";
}

function toDateTimeInputValue(iso: string, timeZone: string) {
  const day = dateOfIsoInTimeZone(iso, timeZone);
  const time = timeOfIsoInTimeZone(iso, timeZone);
  return `${day}T${time}`;
}

function toIsoFromDateTimeInput(value: string, timeZone: string) {
  const [day, time] = value.split("T");
  if (!day || !time) {
    return "";
  }
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return "";
  }
  return makeIsoWithZone(day, hour, minute, timeZone);
}

function shiftToInput(shift: Shift): ShiftInput {
  return {
    id: isUuid(shift.id) ? shift.id : undefined,
    location_id: shift.location_id,
    employee_id: shift.employee_id,
    role_id: shift.role_id,
    start_at: shift.start_at,
    end_at: shift.end_at,
    break_minutes: shift.break_minutes,
    hourly_wage: shift.hourly_wage,
    notes: shift.notes,
    status: shift.status,
    cancel_reason: shift.cancel_reason,
  };
}

export function WeeklySchedule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<string>(() => toDateOnly(startOfWeek(new Date(), "mon")));
  const [companySettings, setCompanySettings] = useState<Required<CompanySettings>>({
    locale: DEFAULT_FORMAT.locale,
    currency: DEFAULT_FORMAT.currency,
    weekly_budget_limit: null,
    week_starts_on: "mon",
    default_shift_start: "09:00",
    default_shift_end: "17:00",
  });

  const [editingShift, setEditingShift] = useState<EditableShift | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [closeTargetShift, setCloseTargetShift] = useState<Shift | null>(null);
  const [cancelTargetShift, setCancelTargetShift] = useState<Shift | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const [upsertQueue, setUpsertQueue] = useState<Record<string, ShiftInput>>({});
  const upsertQueueRef = useRef<Record<string, ShiftInput>>({});
  const isFlushingRef = useRef(false);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId),
    [locations, selectedLocationId],
  );
  const tz = selectedLocation?.timezone ?? DEFAULT_FORMAT.timeZone ?? "Europe/Istanbul";
  const formatConfig = useMemo(
    () => resolveFormatConfig({ locale: companySettings.locale, currency: companySettings.currency, timeZone: tz }),
    [companySettings.locale, companySettings.currency, tz],
  );
  const { formatDateDisplay, formatTimeHM, formatNumber, formatCurrency } = useMemo(() => makeFormatters(formatConfig), [formatConfig]);

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (!start || !end) {
      return "";
    }
    const startAnchor = makeIsoWithZone(start, 12, 0, tz);
    const endAnchor = makeIsoWithZone(end, 12, 0, tz);
    return `${formatDateDisplay(startAnchor)} - ${formatDateDisplay(endAnchor)}`;
  }, [weekDays, formatDateDisplay, tz]);

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    const body = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? `Request failed: ${response.status}`);
    }

    return body.data as T;
  }

  async function loadBaseData() {
    setLoading(true);
    setError(null);
    try {
      const [locationRows, roleRows, companySettingsRow] = await Promise.all([
        fetchJson<Location[]>("/api/locations"),
        fetchJson<Role[]>("/api/roles"),
        fetchJson<CompanySettings>("/api/company/settings"),
      ]);

      setLocations(locationRows);
      setRoles(roleRows);
      setCompanySettings({
        locale: companySettingsRow.locale ?? DEFAULT_FORMAT.locale,
        currency: companySettingsRow.currency ?? DEFAULT_FORMAT.currency,
        weekly_budget_limit: normalizeBudgetLimit(companySettingsRow.weekly_budget_limit),
        week_starts_on: companySettingsRow.week_starts_on === "sun" ? "sun" : "mon",
        default_shift_start: companySettingsRow.default_shift_start ?? "09:00",
        default_shift_end: companySettingsRow.default_shift_end ?? "17:00",
      });

      const initialLocationId = selectedLocationId || locationRows[0]?.id || "";
      setSelectedLocationId(initialLocationId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load schedule base data");
    } finally {
      setLoading(false);
    }
  }

  async function loadWeekData(locationId: string, currentWeekStart: string) {
    if (!locationId) {
      setEmployees([]);
      setShifts([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [employeeRows, shiftRows] = await Promise.all([
        fetchJson<Employee[]>(`/api/employees?locationId=${encodeURIComponent(locationId)}`),
        fetchJson<Shift[]>(
          `/api/schedule?locationId=${encodeURIComponent(locationId)}&weekStart=${encodeURIComponent(currentWeekStart)}`,
        ),
      ]);

      setEmployees(employeeRows);
      setShifts(shiftRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }

  function applyOptimisticShift(shift: Shift) {
    setShifts((current) => {
      const index = current.findIndex((item) => item.id === shift.id);
      if (index === -1) {
        return [...current, shift];
      }
      return current.map((item) => (item.id === shift.id ? shift : item));
    });
  }

  function queueShiftUpsert(shift: Shift) {
    const key = shift.id;
    const payload = shiftToInput(shift);
    upsertQueueRef.current = { ...upsertQueueRef.current, [key]: payload };
    setUpsertQueue(upsertQueueRef.current);
  }

  async function flushQueuedUpserts() {
    if (isFlushingRef.current) {
      return;
    }

    const snapshot = upsertQueueRef.current;
    const payload = Object.values(snapshot);
    if (payload.length === 0) {
      return;
    }

    upsertQueueRef.current = {};
    setUpsertQueue({});

    isFlushingRef.current = true;
    setSaving(true);
    setError(null);

    try {
      await fetchJson<Shift[]>("/api/shifts/bulk-upsert", {
        method: "POST",
        body: JSON.stringify({ shifts: payload }),
      });
      await loadWeekData(selectedLocationId, weekStart);
    } catch (saveError) {
      const restored = { ...snapshot, ...upsertQueueRef.current };
      upsertQueueRef.current = restored;
      setUpsertQueue(restored);
      setError(saveError instanceof Error ? saveError.message : "Failed to save shifts");
    } finally {
      isFlushingRef.current = false;
      setSaving(false);
    }
  }

  async function deleteShift(shiftId: string) {
    if (isTempId(shiftId)) {
      setShifts((current) => current.filter((shift) => shift.id !== shiftId));
      const next = { ...upsertQueueRef.current };
      delete next[shiftId];
      upsertQueueRef.current = next;
      setUpsertQueue(next);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await fetchJson<{ id: string }>(`/api/shifts/${shiftId}`, { method: "DELETE" });
      setShifts((current) => current.filter((shift) => shift.id !== shiftId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete shift");
    } finally {
      setSaving(false);
    }
  }

  function onDragStart(event: DragEvent<HTMLDivElement>, shift: Shift) {
    if (statusOfShift(shift) !== "open") {
      return;
    }
    event.dataTransfer.setData("application/json", JSON.stringify({ shiftId: shift.id }));
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function onDrop(event: DragEvent<HTMLDivElement>, targetEmployeeId: string, targetDate: string) {
    event.preventDefault();

    try {
      const raw = event.dataTransfer.getData("application/json");
      const payload = JSON.parse(raw) as { shiftId?: string };
      if (!payload.shiftId) {
        return;
      }

      const source = shifts.find((item) => item.id === payload.shiftId);
      if (!source) {
        return;
      }
      if (statusOfShift(source) !== "open") {
        return;
      }

      const next: Shift = {
        ...source,
        employee_id: targetEmployeeId,
        start_at: setDateKeepingTime(source.start_at, targetDate, tz),
        end_at: setDateKeepingTime(source.end_at, targetDate, tz),
      };

      applyOptimisticShift(next);
      queueShiftUpsert(next);
    } catch {
      // Ignore malformed drop payload.
    }
  }

  function openEditModal(shift: Shift) {
    if (statusOfShift(shift) !== "open") {
      return;
    }
    setEditingShift({
      id: shift.id,
      location_id: shift.location_id,
      employee_id: shift.employee_id,
      role_id: shift.role_id,
      start_at: shift.start_at,
      end_at: shift.end_at,
      break_minutes: shift.break_minutes,
      hourly_wage: String(shift.hourly_wage),
      notes: shift.notes ?? "",
    });
    setIsDialogOpen(true);
  }

  function onCancelEditModal() {
    if (editingShift && isTempId(editingShift.id)) {
      setShifts((current) => current.filter((shift) => shift.id !== editingShift.id));
      const next = { ...upsertQueueRef.current };
      delete next[editingShift.id];
      upsertQueueRef.current = next;
      setUpsertQueue(next);
    }
    setIsDialogOpen(false);
    setEditingShift(null);
  }

  async function onSaveEditModal() {
    if (!editingShift) {
      return;
    }

    const parsedWage = Number(editingShift.hourly_wage);
    if (Number.isNaN(parsedWage) || parsedWage < 0) {
      setError("Hourly wage must be a valid non-negative number");
      return;
    }
    if (editingShift.break_minutes < 0) {
      setError("Break minutes must be a valid non-negative number");
      return;
    }
    if (new Date(editingShift.end_at).getTime() <= new Date(editingShift.start_at).getTime()) {
      setError("End time must be after start time");
      return;
    }

    const updated: Shift = {
      id: editingShift.id,
      location_id: editingShift.location_id,
      employee_id: editingShift.employee_id,
      role_id: editingShift.role_id,
      start_at: editingShift.start_at,
      end_at: editingShift.end_at,
      break_minutes: editingShift.break_minutes,
      hourly_wage: parsedWage,
      notes: editingShift.notes || null,
      status: "open",
    };

    if (isTempId(editingShift.id)) {
      applyOptimisticShift(updated);
      queueShiftUpsert(updated);
      await flushQueuedUpserts();
    } else {
      setSaving(true);
      setError(null);
      try {
        await fetchJson<Shift>(`/api/shifts/${editingShift.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            start_at: editingShift.start_at,
            end_at: editingShift.end_at,
            break_minutes: editingShift.break_minutes,
            employee_id: editingShift.employee_id,
            role_id: editingShift.role_id,
            hourly_wage: parsedWage,
            notes: editingShift.notes || null,
          }),
        });
        await loadWeekData(selectedLocationId, weekStart);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to save shift");
        return;
      } finally {
        setSaving(false);
      }
    }

    setIsDialogOpen(false);
    setEditingShift(null);
  }

  async function closeShift(shift: Shift) {
    if (statusOfShift(shift) !== "open" || isTempId(shift.id)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await fetchJson<Shift>(`/api/shifts/${shift.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      });
      await loadWeekData(selectedLocationId, weekStart);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Failed to close shift");
    } finally {
      setSaving(false);
      setCloseTargetShift(null);
    }
  }

  async function cancelShift(shift: Shift, reason: string) {
    if (statusOfShift(shift) === "cancelled" || isTempId(shift.id)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await fetchJson<Shift>(`/api/shifts/${shift.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", cancel_reason: reason || null }),
      });
      await loadWeekData(selectedLocationId, weekStart);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Failed to cancel shift");
    } finally {
      setSaving(false);
      setCancelTargetShift(null);
      setCancelReason("");
    }
  }

  function onDoubleClickEmptyCell(employee: Employee, dateStr: string, cellShifts: Shift[]) {
    if (cellShifts.length > 0 || !selectedLocationId) {
      return;
    }

    const role = roles.find((item) => item.id === employee.role_id);
    const hourlyWage = employee.hourly_rate ?? role?.hourly_wage_default ?? 0;
    const defaultStart = parseTimeInput(companySettings.default_shift_start, 9, 0);
    const defaultEnd = parseTimeInput(companySettings.default_shift_end, 17, 0);

    const tempId = `tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
    const tempShift: Shift = {
      id: tempId,
      location_id: selectedLocationId,
      employee_id: employee.id,
      role_id: employee.role_id,
      start_at: makeIsoWithZone(dateStr, defaultStart.hour, defaultStart.minute, tz),
      end_at: makeIsoWithZone(dateStr, defaultEnd.hour, defaultEnd.minute, tz),
      break_minutes: 0,
      hourly_wage: hourlyWage,
      notes: null,
    };

    applyOptimisticShift(tempShift);
    openEditModal(tempShift);
  }

  function onQuickAddShift() {
    if (!selectedLocationId || employees.length === 0 || weekDays.length === 0) {
      return;
    }
    const employee = selectedEmployeeId
      ? employees.find((item) => item.id === selectedEmployeeId) ?? employees[0]
      : employees[0];
    const targetDay = weekDays[0];
    const existing = shiftsByCell.get(`${employee.id}:${targetDay}`) ?? [];
    onDoubleClickEmptyCell(employee, targetDay, existing);
  }

  async function copyLastWeek() {
    if (!selectedLocationId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const previousWeek = addDaysToDateString(weekStart, -7);

      const previousShifts = await fetchJson<Shift[]>(
        `/api/schedule?locationId=${encodeURIComponent(selectedLocationId)}&weekStart=${encodeURIComponent(previousWeek)}`,
      );

      const payload: ShiftInput[] = previousShifts.map((shift) => {
        const startDay = dateOfIsoInTimeZone(shift.start_at, tz);
        const endDay = dateOfIsoInTimeZone(shift.end_at, tz);
        const [startHourRaw, startMinuteRaw] = timeOfIsoInTimeZone(shift.start_at, tz).split(":");
        const [endHourRaw, endMinuteRaw] = timeOfIsoInTimeZone(shift.end_at, tz).split(":");
        const startHour = Number(startHourRaw);
        const startMinute = Number(startMinuteRaw);
        const endHour = Number(endHourRaw);
        const endMinute = Number(endMinuteRaw);
        const nextStart = makeIsoWithZone(
          addDaysToDateString(startDay, 7),
          Number.isFinite(startHour) ? startHour : 0,
          Number.isFinite(startMinute) ? startMinute : 0,
          tz,
        );
        const nextEnd = makeIsoWithZone(
          addDaysToDateString(endDay, 7),
          Number.isFinite(endHour) ? endHour : 0,
          Number.isFinite(endMinute) ? endMinute : 0,
          tz,
        );

        return {
          location_id: selectedLocationId,
          employee_id: shift.employee_id,
          role_id: shift.role_id,
          start_at: nextStart,
          end_at: nextEnd,
          break_minutes: shift.break_minutes,
          hourly_wage: shift.hourly_wage,
          notes: shift.notes,
        };
      });

      if (payload.length > 0) {
        await fetchJson<Shift[]>("/api/shifts/bulk-upsert", {
          method: "POST",
          body: JSON.stringify({ shifts: payload }),
        });
      }

      await loadWeekData(selectedLocationId, weekStart);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Failed to copy previous week");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    if (!selectedLocationId) {
      return;
    }
    void loadWeekData(selectedLocationId, weekStart);
  }, [selectedLocationId, weekStart]);

  useEffect(() => {
    setWeekStart((current) => {
      const aligned = toDateOnly(startOfWeek(parseDateOnly(current), companySettings.week_starts_on));
      return aligned === current ? current : aligned;
    });
  }, [companySettings.week_starts_on]);

  useEffect(() => {
    if (Object.keys(upsertQueue).length === 0) {
      return;
    }

    const timeout = setTimeout(() => {
      void flushQueuedUpserts();
    }, 500);

    return () => clearTimeout(timeout);
  }, [upsertQueue]);

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const date = dateOfIsoLocal(shift.start_at, tz);
      const key = `${shift.employee_id}:${date}`;
      const list = map.get(key) ?? [];
      list.push(shift);
      map.set(key, list);
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.start_at.localeCompare(b.start_at));
    }

    return map;
  }, [shifts, tz]);

  const dayCostTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const shift of shifts) {
      const day = dateOfIsoLocal(shift.start_at, tz);
      const metrics = calcShiftMetrics(shift);
      totals.set(day, (totals.get(day) ?? 0) + metrics.shift_cost);
    }
    return totals;
  }, [shifts, tz]);

  const weekCostTotal = useMemo(
    () => [...dayCostTotals.values()].reduce((sum, current) => sum + current, 0),
    [dayCostTotals],
  );
  const weeklyCostBreakdown = useMemo<EmployeeCostBreakdown[]>(() => {
    const byEmployee = new Map<string, EmployeeCostBreakdown>();

    for (const shift of shifts) {
      const metrics = calcShiftMetrics(shift);
      const current = byEmployee.get(shift.employee_id);
      if (current) {
        current.total_hours += metrics.duration_hours;
        current.total_cost += metrics.shift_cost;
        continue;
      }

      byEmployee.set(shift.employee_id, {
        employee_id: shift.employee_id,
        employee_name: employees.find((employee) => employee.id === shift.employee_id)?.full_name ?? "Employee",
        total_hours: metrics.duration_hours,
        total_cost: metrics.shift_cost,
      });
    }

    return [...byEmployee.values()].sort((a, b) => b.total_cost - a.total_cost);
  }, [shifts, employees]);
  const topCostContributor = weeklyCostBreakdown[0];
  const selectedBreakdownEmployee = useMemo(
    () => weeklyCostBreakdown.find((item) => item.employee_id === selectedEmployeeId) ?? null,
    [weeklyCostBreakdown, selectedEmployeeId],
  );
  const visibleEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLocaleLowerCase("en-US");
    return employees.filter((employee) => {
      const selectedMatch = selectedEmployeeId ? employee.id === selectedEmployeeId : true;
      const searchMatch = search.length === 0 || employee.full_name.toLocaleLowerCase("en-US").includes(search);
      return selectedMatch && searchMatch;
    });
  }, [employeeSearch, employees, selectedEmployeeId]);
  const weeklyBudgetLimit = normalizeBudgetLimit(companySettings.weekly_budget_limit);
  const exceededBudgetAmount = weeklyBudgetLimit !== null && weekCostTotal > weeklyBudgetLimit
    ? weekCostTotal - weeklyBudgetLimit
    : 0;

  if (loading && locations.length === 0) {
    return (
      <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!loading && locations.length === 0) {
    return (
      <EmptyState
        title="No locations yet"
        description="Add a location in Settings or Setup to start building a weekly schedule."
      />
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white">
        <DataTableToolbar
          searchValue={employeeSearch}
          onSearchChange={setEmployeeSearch}
          searchPlaceholder="Search employee"
          filters={(
            <>
              <div className="flex items-center gap-2">
                <Label htmlFor="location">Location</Label>
                <Select id="location" value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)}>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-xs text-slate-500">Timezone: {tz}</p>
            </>
          )}
          actions={(
            <>
              <Button type="button" onClick={() => void copyLastWeek()} disabled={!selectedLocationId || saving}>
                Copy last week
              </Button>
              <Button type="button" variant="outline" onClick={onQuickAddShift} disabled={!selectedLocationId || employees.length === 0}>
                Quick add shift
              </Button>
            </>
          )}
        />
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setWeekStart(addDaysToDateString(weekStart, -7))}
          >
            Previous
          </Button>
          <p data-testid="week-range-label" className="min-w-[220px] text-center text-sm font-medium text-slate-700">
            {weekLabel}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setWeekStart(addDaysToDateString(weekStart, 7))}
          >
            Next
          </Button>
        </div>
          <p className="text-sm text-slate-700">Week cost: {formatCurrency(weekCostTotal)}</p>
          {selectedBreakdownEmployee ? (
            <>
              <Badge variant="secondary">Filtered: {selectedBreakdownEmployee.employee_name}</Badge>
              <Button type="button" variant="outline" onClick={() => setSelectedEmployeeId(null)}>
                Clear filter
              </Button>
            </>
          ) : null}
          {exceededBudgetAmount > 0 ? (
            <Badge variant="destructive">Weekly budget exceeded by {formatCurrency(exceededBudgetAmount)}</Badge>
          ) : null}
          {saving ? <p className="text-sm text-slate-600">Saving...</p> : null}
        </div>
      </header>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <details className="rounded-lg border border-slate-200 bg-white" open={weeklyCostBreakdown.length > 0}>
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-800">
          <span>Cost breakdown</span>
          {topCostContributor ? (
            <Badge variant="secondary">Top: {topCostContributor.employee_name}</Badge>
          ) : null}
        </summary>
        <div className="border-t border-slate-100 px-4 py-3">
          {weeklyCostBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500">No shifts in this week.</p>
          ) : (
            <div className="space-y-2">
              {weeklyCostBreakdown.map((row) => (
                <button
                  key={row.employee_id}
                  type="button"
                  onClick={() => setSelectedEmployeeId((current) => (current === row.employee_id ? null : row.employee_id))}
                  className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md px-2 py-1 text-left text-sm transition-colors ${
                    selectedEmployeeId === row.employee_id ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                  }`}
                >
                  <p className={`font-medium ${selectedEmployeeId === row.employee_id ? "text-white" : "text-slate-800"}`}>
                    {row.employee_name}
                  </p>
                  <p className={selectedEmployeeId === row.employee_id ? "text-slate-200" : "text-slate-600"}>
                    {formatNumber(row.total_hours)}h
                  </p>
                  <p className={`font-semibold ${selectedEmployeeId === row.employee_id ? "text-white" : "text-slate-900"}`}>
                    {formatCurrency(row.total_cost)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </details>

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[220px_repeat(7,minmax(140px,1fr))] border-b border-slate-200 bg-slate-50">
            <div className="p-3 text-sm font-semibold text-slate-700">Employee</div>
            {weekDays.map((dayStr) => (
              <div
                key={dayStr}
                data-testid={`week-day-${dayStr}`}
                className="border-l border-slate-200 p-3 text-sm font-semibold text-slate-700"
              >
                <p>{dateLabel(dayStr, tz, formatDateDisplay)}</p>
                <p className="text-xs font-medium text-slate-500">{formatCurrency(dayCostTotals.get(dayStr) ?? 0)}</p>
              </div>
            ))}
          </div>

          {visibleEmployees.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">
              {employeeSearch.trim().length > 0
                ? "No employees match this search."
                : "No employees found for this location."}
            </div>
          ) : null}

          {visibleEmployees.map((employee) => (
            <div key={employee.id} className="grid grid-cols-[220px_repeat(7,minmax(140px,1fr))] border-b border-slate-100">
              <div className="p-3 text-sm font-medium text-slate-900">{employee.full_name}</div>
              {weekDays.map((dateStr) => {
                const key = `${employee.id}:${dateStr}`;
                const cellShifts = shiftsByCell.get(key) ?? [];

                return (
                  <div
                    key={key}
                    className="min-h-[92px] border-l border-slate-100 p-2"
                    onDragOver={onDragOver}
                    onDrop={(event) => onDrop(event, employee.id, dateStr)}
                    onDoubleClick={() => onDoubleClickEmptyCell(employee, dateStr, cellShifts)}
                  >
                    <div className="space-y-2">
                      {cellShifts.map((shift) => {
                        const roleName = roles.find((role) => role.id === shift.role_id)?.name ?? "Role";
                        const metrics = calcShiftMetrics(shift);
                        const shiftStatus = statusOfShift(shift);
                        const isOpen = shiftStatus === "open";
                        const isClosed = shiftStatus === "closed";
                        const isCancelled = shiftStatus === "cancelled";
                        return (
                          <div
                            key={shift.id}
                            draggable={isOpen}
                            onDragStart={(event) => onDragStart(event, shift)}
                            onClick={() => {
                              if (isOpen) {
                                openEditModal(shift);
                              }
                            }}
                            className={`rounded-md border px-2 py-1 text-xs ${
                              isCancelled
                                ? "border-slate-200 bg-slate-50 text-slate-500"
                                : "border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200"
                            } ${isOpen ? "cursor-move" : "cursor-default"}`}
                            title={
                              isOpen
                                ? "Drag to another day/employee or click to edit"
                                : isClosed
                                  ? "Closed shifts are locked"
                                  : "Cancelled shift"
                            }
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="font-semibold">{fmtTimeRange(shift.start_at, shift.end_at, formatTimeHM)}</p>
                              <Badge variant={isCancelled ? "outline" : isClosed ? "secondary" : "default"}>
                                {shiftStatus.charAt(0).toUpperCase() + shiftStatus.slice(1)}
                              </Badge>
                            </div>
                            <p>{roleName} • {formatNumber(metrics.duration_hours)}h</p>
                            <p className="text-slate-600">{formatCurrency(metrics.shift_cost)}</p>
                            {shift.cancel_reason ? (
                              <p className="text-slate-500">Reason: {shift.cancel_reason}</p>
                            ) : null}
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                disabled={isCancelled}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (isOpen) {
                                    openEditModal(shift);
                                  }
                                }}
                              >
                                Details
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Sheet open={isDialogOpen} onOpenChange={(open) => (!open ? onCancelEditModal() : setIsDialogOpen(true))}>
        <SheetHeader>
          <SheetTitle>Shift details</SheetTitle>
          <SheetDescription>Edit assignment, timing, and status in one place.</SheetDescription>
        </SheetHeader>

        {editingShift ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="start-at">Start</Label>
              <Input
                id="start-at"
                type="datetime-local"
                value={toDateTimeInputValue(editingShift.start_at, tz)}
                onChange={(event) =>
                  setEditingShift((current) =>
                    current
                      ? {
                          ...current,
                          start_at: toIsoFromDateTimeInput(event.target.value, tz) || current.start_at,
                        }
                      : current,
                  )
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="end-at">End</Label>
              <Input
                id="end-at"
                type="datetime-local"
                value={toDateTimeInputValue(editingShift.end_at, tz)}
                onChange={(event) =>
                  setEditingShift((current) =>
                    current
                      ? {
                          ...current,
                          end_at: toIsoFromDateTimeInput(event.target.value, tz) || current.end_at,
                        }
                      : current,
                  )
                }
              />
            </div>

            <div className="col-span-2 space-y-1">
              <Label htmlFor="employee">Employee</Label>
              <Select
                id="employee"
                value={editingShift.employee_id}
                onChange={(event) =>
                  setEditingShift((current) =>
                    current
                      ? {
                          ...current,
                          employee_id: event.target.value,
                        }
                      : current,
                  )
                }
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="col-span-2 space-y-1">
              <Label htmlFor="role">Role</Label>
              <Select
                id="role"
                value={editingShift.role_id}
                onChange={(event) =>
                  setEditingShift((current) =>
                    current
                      ? {
                          ...current,
                          role_id: event.target.value,
                        }
                      : current,
                  )
                }
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="break">Break minutes</Label>
              <Input
                id="break"
                type="number"
                min={0}
                value={editingShift.break_minutes}
                onChange={(event) =>
                  setEditingShift((current) =>
                    current
                      ? {
                          ...current,
                          break_minutes: Math.max(0, Number(event.target.value || 0)),
                        }
                      : current,
                  )
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="hourly">Hourly wage</Label>
              <Input
                id="hourly"
                type="number"
                min={0}
                step="0.01"
                value={editingShift.hourly_wage}
                onChange={(event) =>
                  setEditingShift((current) =>
                    current
                      ? {
                          ...current,
                          hourly_wage: event.target.value,
                        }
                      : current,
                  )
                }
              />
            </div>

            <div className="col-span-2 space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                rows={3}
                className="w-full rounded-md border border-slate-300 p-2 text-sm"
                value={editingShift.notes}
                onChange={(event) =>
                  setEditingShift((current) =>
                    current
                      ? {
                          ...current,
                          notes: event.target.value,
                        }
                      : current,
                  )
                }
              />
            </div>
          </div>
        ) : null}

        <SheetFooter>
          {editingShift && !isTempId(editingShift.id) ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const original = shifts.find((shift) => shift.id === editingShift.id);
                  if (original) {
                    setCloseTargetShift(original);
                  }
                }}
              >
                Close shift
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const original = shifts.find((shift) => shift.id === editingShift.id);
                  if (original) {
                    setCancelTargetShift(original);
                  }
                }}
              >
                Cancel shift
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (!editingShift) {
                return;
              }
              void deleteShift(editingShift.id);
              setIsDialogOpen(false);
              setEditingShift(null);
            }}
          >
            Delete
          </Button>
          <Button type="button" variant="secondary" onClick={onCancelEditModal}>
            Close
          </Button>
          <Button type="button" onClick={() => void onSaveEditModal()}>
            Save
          </Button>
        </SheetFooter>
      </Sheet>

      <Dialog open={Boolean(closeTargetShift)} onOpenChange={(open) => (!open ? setCloseTargetShift(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close shift?</DialogTitle>
            <DialogDescription>Closed shifts stay visible but become locked for editing.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCloseTargetShift(null)}>
              Keep open
            </Button>
            <Button type="button" onClick={() => (closeTargetShift ? void closeShift(closeTargetShift) : undefined)}>
              Close shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cancelTargetShift)} onOpenChange={(open) => (!open ? setCancelTargetShift(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel shift?</DialogTitle>
            <DialogDescription>Cancelled shifts are excluded from cost calculations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Input
              id="cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Reason for cancellation"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCancelTargetShift(null);
                setCancelReason("");
              }}
            >
              Keep shift
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => (cancelTargetShift ? void cancelShift(cancelTargetShift, cancelReason) : undefined)}
            >
              Cancel shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
