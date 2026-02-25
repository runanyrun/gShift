import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const bodySchema = z.object({
  location_id: z.string().uuid(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function offsetForTimeZone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date);

    const raw = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
    if (raw === "GMT") {
      return "+00:00";
    }

    const normalized = raw.replace("GMT", "");
    return normalized.length === 6 ? normalized : "+00:00";
  } catch {
    return "+00:00";
  }
}

function makeIsoWithZone(day: string, hour: number, minute: number, timeZone: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, date, hour, minute, 0));
  const offset = offsetForTimeZone(probe, timeZone);
  return `${day}T${pad2(hour)}:${pad2(minute)}:00${offset}`;
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

    const rangeStart = new Date(`${body.week_start}T00:00:00Z`);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 5);

    const { data: existingDemo, error: existingDemoError } = await supabase
      .from("shifts")
      .select("id")
      .eq("company_id", companyId)
      .eq("location_id", body.location_id)
      .eq("notes", "Demo shift")
      .gte("start_at", rangeStart.toISOString())
      .lt("start_at", rangeEnd.toISOString())
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

    const base = new Date(`${body.week_start}T00:00:00Z`);
    const shifts: Array<Record<string, unknown>> = [];

    for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
      const current = new Date(base);
      current.setUTCDate(base.getUTCDate() + dayOffset);
      const day = current.toISOString().slice(0, 10);

      for (const employee of employeeRows) {
        const hourlyWage = employee.hourly_rate ?? roleMap.get(employee.role_id) ?? 0;

        shifts.push({
          company_id: companyId,
          location_id: body.location_id,
          employee_id: employee.id,
          role_id: employee.role_id,
          start_at: makeIsoWithZone(day, 9, 0, location.timezone),
          end_at: makeIsoWithZone(day, 17, 0, location.timezone),
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
