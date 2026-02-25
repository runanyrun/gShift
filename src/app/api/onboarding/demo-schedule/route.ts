import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const bodySchema = z.object({
  location_id: z.string().uuid(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

type EmployeeRow = {
  id: string;
  role_id: string;
  hourly_rate: number | null;
};

type RoleRow = {
  id: string;
  hourly_wage_default: number | null;
};

function isColumnMissingError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }
  const msg = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703"
    || error.code === "PGRST204"
    || msg.includes("column")
    || msg.includes("does not exist")
    || msg.includes("schema cache")
  );
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function parseTime(value: string | undefined, fallback: string): { hour: number; minute: number } {
  const source = value ?? fallback;
  const [hourRaw, minuteRaw] = source.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    const [fallbackHourRaw, fallbackMinuteRaw] = fallback.split(":");
    return { hour: Number(fallbackHourRaw), minute: Number(fallbackMinuteRaw) };
  }

  return { hour, minute };
}

function makeIsoWithZone(day: string, hour: number, minute: number, timeZone: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const targetWallClockUtc = Date.UTC(year, month - 1, date, hour, minute, 0, 0);
  let candidate = new Date(targetWallClockUtc);

  for (let i = 0; i < 8; i += 1) {
    const p = getTimeZoneParts(candidate, timeZone);
    const zonedWallClockUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
    const diffMinutes = Math.round((targetWallClockUtc - zonedWallClockUtc) / 60000);

    if (diffMinutes === 0) {
      return candidate.toISOString();
    }
    candidate = new Date(candidate.getTime() + diffMinutes * 60000);
  }

  return candidate.toISOString();
}

async function resolveCompanySchedulePrefs(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  companyId: string,
): Promise<{ timezone: string; default_shift_start: string; default_shift_end: string }> {
  const { data, error } = await supabase
    .from("companies")
    .select("timezone, default_shift_start, default_shift_end")
    .eq("id", companyId)
    .maybeSingle();

  if (isColumnMissingError(error)) {
    const fallback = await supabase.from("companies").select("timezone").eq("id", companyId).maybeSingle();
    if (fallback.error && !isColumnMissingError(fallback.error)) {
      throw new HttpError(400, fallback.error.message);
    }

    const fallbackTimezone = (fallback.data as { timezone?: string | null } | null)?.timezone?.trim();
    return {
      timezone: fallbackTimezone && fallbackTimezone.length > 0 ? fallbackTimezone : "Europe/Istanbul",
      default_shift_start: "09:00",
      default_shift_end: "17:00",
    };
  }

  if (error && !isColumnMissingError(error)) {
    throw new HttpError(400, error.message);
  }

  const row = (data as {
    timezone?: string | null;
    default_shift_start?: string | null;
    default_shift_end?: string | null;
  } | null);
  const timezone = row?.timezone?.trim();
  const start = row?.default_shift_start?.trim() || "09:00";
  const end = row?.default_shift_end?.trim() || "17:00";
  return {
    timezone: timezone && timezone.length > 0 ? timezone : "Europe/Istanbul",
    default_shift_start: start,
    default_shift_end: end,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const user = await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);
    const body = await parseJson(request, bodySchema);

    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("id, timezone")
      .eq("company_id", companyId)
      .eq("id", body.location_id)
      .maybeSingle();

    if (locationError) {
      throw new HttpError(400, locationError.message);
    }

    if (!location) {
      throw new HttpError(404, "Location not found");
    }

    const companyPrefs = await resolveCompanySchedulePrefs(supabase, companyId);
    const scheduleTimezone = location.timezone?.trim() || companyPrefs.timezone || "Europe/Istanbul";
    const startTime = parseTime(body.start_time ?? companyPrefs.default_shift_start, "09:00");
    const endTime = parseTime(body.end_time ?? companyPrefs.default_shift_end, "17:00");
    const isOvernight =
      startTime.hour > endTime.hour || (startTime.hour === endTime.hour && startTime.minute > endTime.minute);

    const weekEnd = addDaysToDateString(body.week_start, 5);
    const rangeStartIso = makeIsoWithZone(body.week_start, 0, 0, scheduleTimezone);
    const rangeEndIso = makeIsoWithZone(weekEnd, 0, 0, scheduleTimezone);

    const { data: existingDemo, error: existingDemoError } = await supabase
      .from("shifts")
      .select("id")
      .eq("company_id", companyId)
      .eq("location_id", body.location_id)
      .eq("notes", "Demo shift")
      .gte("start_at", rangeStartIso)
      .lt("start_at", rangeEndIso)
      .limit(1);

    if (existingDemoError) {
      throw new HttpError(400, existingDemoError.message);
    }

    if ((existingDemo ?? []).length > 0) {
      return jsonOk({ inserted: 0, skipped: true });
    }

    const { data: employees, error: employeesError } = await supabase
      .from("employees")
      .select("id, role_id, hourly_rate")
      .eq("company_id", companyId)
      .eq("location_id", body.location_id)
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (employeesError) {
      throw new HttpError(400, employeesError.message);
    }

    const employeeRows = (employees ?? []) as EmployeeRow[];
    if (employeeRows.length === 0) {
      throw new HttpError(400, "No active employees found for selected location");
    }

    const roleIds = [...new Set(employeeRows.map((row) => row.role_id))];

    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select("id, hourly_wage_default")
      .eq("company_id", companyId)
      .in("id", roleIds);

    if (rolesError) {
      throw new HttpError(400, rolesError.message);
    }

    const roleMap = new Map<string, number | null>();
    for (const role of (roles ?? []) as RoleRow[]) {
      roleMap.set(role.id, role.hourly_wage_default ?? null);
    }

    const shifts: Array<Record<string, unknown>> = [];

    for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
      const day = addDaysToDateString(body.week_start, dayOffset);

      for (const employee of employeeRows) {
        const hourlyWage = employee.hourly_rate ?? roleMap.get(employee.role_id) ?? 0;

        shifts.push({
          company_id: companyId,
          location_id: body.location_id,
          employee_id: employee.id,
          role_id: employee.role_id,
          start_at: makeIsoWithZone(day, startTime.hour, startTime.minute, scheduleTimezone),
          end_at: makeIsoWithZone(
            isOvernight ? addDaysToDateString(day, 1) : day,
            endTime.hour,
            endTime.minute,
            scheduleTimezone,
          ),
          break_minutes: 0,
          hourly_wage: hourlyWage,
          notes: "Demo shift",
          created_by: user.id,
        });
      }
    }

    const { error: insertError } = await supabase.from("shifts").insert(shifts);

    if (insertError) {
      throw new HttpError(400, insertError.message);
    }

    return jsonOk({ inserted: shifts.length }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
