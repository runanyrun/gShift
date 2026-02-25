import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const bodySchema = z.object({
  location_id: z.string().uuid(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

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

async function resolveCompanyTimezone(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  companyId: string,
): Promise<string> {
  const { data, error } = await supabase.from("companies").select("timezone").eq("id", companyId).maybeSingle();

  if (error && !isColumnMissingError(error)) {
    throw new HttpError(400, error.message);
  }

  const timezone = (data as { timezone?: string | null } | null)?.timezone?.trim();
  return timezone && timezone.length > 0 ? timezone : "Europe/Istanbul";
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
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

    const companyTimezone = await resolveCompanyTimezone(supabase, companyId);
    const scheduleTimezone = location.timezone?.trim() || companyTimezone || "Europe/Istanbul";

    const rangeStartIso = makeIsoWithZone(body.week_start, 0, 0, scheduleTimezone);
    const rangeEndIso = makeIsoWithZone(addDaysToDateString(body.week_start, 7), 0, 0, scheduleTimezone);

    const { data, error } = await supabase
      .from("shifts")
      .update({ notes: null })
      .eq("company_id", companyId)
      .eq("location_id", body.location_id)
      .eq("notes", "Demo shift")
      .gte("start_at", rangeStartIso)
      .lt("start_at", rangeEndIso)
      .select("id");

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk({ converted: (data ?? []).length });
  } catch (error) {
    return handleRouteError(error);
  }
}
