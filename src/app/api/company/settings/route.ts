import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const bodySchema = z.object({
  locale: z.enum(["tr-TR", "en-US", "ar-EG"]).optional(),
  currency: z.enum(["TRY", "USD", "EGP"]).optional(),
  timezone: z.string().min(1).optional(),
  week_starts_on: z.enum(["mon", "sun"]).optional(),
  default_shift_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  default_shift_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weekly_budget_limit: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().min(0).nullable(),
  ).optional(),
});

function normalizeBudget(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function isColumnMissingError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }
  const msg = error.message?.toLowerCase() ?? "";
  const couldNotFindSchemaThing =
    msg.includes("could not find the") && (msg.includes("schema") || msg.includes("cache") || msg.includes("column"));
  return (
    error.code === "42703"
    || error.code === "PGRST204"
    || msg.includes("column")
    || msg.includes("does not exist")
    || msg.includes("schema cache")
    || msg.includes("not found in schema cache")
    || couldNotFindSchemaThing
  );
}

export async function GET() {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const { data, error } = await supabase
      .from("companies")
      .select("id, name, locale, currency, timezone, week_starts_on, default_shift_start, default_shift_end, weekly_budget_limit")
      .eq("id", companyId)
      .single();

    if (isColumnMissingError(error)) {
      const fallback = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", companyId)
        .single();

      if (fallback.error) {
        throw new HttpError(400, fallback.error.message);
      }

      return jsonOk({
        ...fallback.data,
        locale: "tr-TR",
        currency: "TRY",
        timezone: "Europe/Istanbul",
        week_starts_on: "mon",
        default_shift_start: "09:00",
        default_shift_end: "17:00",
        weekly_budget_limit: null,
      });
    }

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk({
      ...data,
      locale: data.locale ?? "tr-TR",
      currency: data.currency ?? "TRY",
      timezone: data.timezone ?? "Europe/Istanbul",
      week_starts_on: data.week_starts_on ?? "mon",
      default_shift_start: data.default_shift_start ?? "09:00",
      default_shift_end: data.default_shift_end ?? "17:00",
      weekly_budget_limit: normalizeBudget(data.weekly_budget_limit),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);
    const body = await parseJson(request, bodySchema);

    const patch: Partial<z.infer<typeof bodySchema>> = {};
    if (body.locale) {
      patch.locale = body.locale;
    }
    if (body.currency) {
      patch.currency = body.currency;
    }
    if (body.timezone) {
      patch.timezone = body.timezone;
    }
    if (body.week_starts_on) {
      patch.week_starts_on = body.week_starts_on;
    }
    if (body.default_shift_start) {
      patch.default_shift_start = body.default_shift_start;
    }
    if (body.default_shift_end) {
      patch.default_shift_end = body.default_shift_end;
    }
    if (body.weekly_budget_limit !== undefined) {
      patch.weekly_budget_limit = body.weekly_budget_limit;
    }

    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "At least one field is required");
    }

    const { data, error } = await supabase
      .from("companies")
      .update(patch)
      .eq("id", companyId)
      .select("id, name, locale, currency, timezone, week_starts_on, default_shift_start, default_shift_end, weekly_budget_limit")
      .single();

    if (isColumnMissingError(error)) {
      const fallback = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", companyId)
        .single();

      if (fallback.error) {
        throw new HttpError(400, fallback.error.message);
      }

      return jsonOk({
        ...fallback.data,
        locale: "tr-TR",
        currency: "TRY",
        timezone: "Europe/Istanbul",
        week_starts_on: "mon",
        default_shift_start: "09:00",
        default_shift_end: "17:00",
        weekly_budget_limit: null,
        warning: "Company settings columns are not available yet (locale/currency not persisted).",
      });
    }

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk({
      ...data,
      locale: data.locale ?? body.locale ?? "tr-TR",
      currency: data.currency ?? body.currency ?? "TRY",
      timezone: data.timezone ?? body.timezone ?? "Europe/Istanbul",
      week_starts_on: data.week_starts_on ?? body.week_starts_on ?? "mon",
      default_shift_start: data.default_shift_start ?? body.default_shift_start ?? "09:00",
      default_shift_end: data.default_shift_end ?? body.default_shift_end ?? "17:00",
      weekly_budget_limit: normalizeBudget(data.weekly_budget_limit ?? body.weekly_budget_limit),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
