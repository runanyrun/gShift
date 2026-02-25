import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  start_at: z.string().datetime({ offset: true }).optional(),
  end_at: z.string().datetime({ offset: true }).optional(),
  break_minutes: z.number().int().min(0).optional(),
  employee_id: z.string().uuid().optional(),
  role_id: z.string().uuid().optional(),
  hourly_wage: z.coerce.number().min(0).max(9999999999.99).optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["open", "closed", "cancelled"]).optional(),
  cancel_reason: z.string().max(2000).nullable().optional(),
});

type ShiftStatus = "open" | "closed" | "cancelled";

function isColumnMissingError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return error.code === "42703" || error.code === "PGRST204" || msg.includes("column") || msg.includes("does not exist");
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const params = paramsSchema.parse(await context.params);

    const { data, error } = await supabase
      .from("shifts")
      .delete()
      .eq("id", params.id)
      .eq("company_id", companyId)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new HttpError(400, error.message);
    }

    if (!data) {
      throw new HttpError(404, "Shift not found");
    }

    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const params = paramsSchema.parse(await context.params);
    const body = await parseJson(request, bodySchema);

    if (Object.keys(body).length === 0) {
      throw new HttpError(400, "No fields provided");
    }

    const { data: existing, error: existingError } = await supabase
      .from("shifts")
      .select("id, status")
      .eq("id", params.id)
      .eq("company_id", companyId)
      .single();

    if (existingError) {
      throw new HttpError(400, existingError.message);
    }

    if (!existing) {
      throw new HttpError(404, "Shift not found");
    }

    const currentStatus = (existing.status as ShiftStatus | null) ?? "open";
    const nextStatus = body.status ?? currentStatus;

    if (currentStatus === "cancelled") {
      throw new HttpError(400, "Cancelled shifts are locked");
    }

    if (body.start_at && body.end_at && new Date(body.end_at).getTime() <= new Date(body.start_at).getTime()) {
      throw new HttpError(400, "end_at must be after start_at");
    }

    const patch: Record<string, unknown> = {};
    if (body.start_at !== undefined) patch.start_at = body.start_at;
    if (body.end_at !== undefined) patch.end_at = body.end_at;
    if (body.break_minutes !== undefined) patch.break_minutes = body.break_minutes;
    if (body.employee_id !== undefined) patch.employee_id = body.employee_id;
    if (body.role_id !== undefined) patch.role_id = body.role_id;
    if (body.hourly_wage !== undefined) patch.hourly_wage = body.hourly_wage;
    if (body.notes !== undefined) patch.notes = body.notes ?? null;
    if (body.cancel_reason !== undefined) patch.cancel_reason = body.cancel_reason ?? null;

    if (body.status !== undefined) {
      patch.status = nextStatus;
      if (nextStatus === "closed" && currentStatus !== "closed") {
        patch.closed_at = new Date().toISOString();
      }
      if (nextStatus === "cancelled") {
        patch.cancelled_at = new Date().toISOString();
      }
    }

    let updateQuery = supabase.from("shifts").update(patch).eq("id", params.id).eq("company_id", companyId);
    let result = await updateQuery
      .select(
        "id, company_id, location_id, employee_id, role_id, start_at, end_at, break_minutes, hourly_wage, notes, status, cancel_reason, cancelled_at, closed_at, created_by, created_at, updated_at",
      )
      .single();

    if (result.error && isColumnMissingError(result.error)) {
      const legacyPatch = { ...patch };
      delete legacyPatch.status;
      delete legacyPatch.cancel_reason;
      delete legacyPatch.cancelled_at;
      delete legacyPatch.closed_at;
      if (Object.keys(legacyPatch).length === 0) {
        throw new HttpError(409, "Shift lifecycle columns are not available yet");
      }

      result = await supabase
        .from("shifts")
        .update(legacyPatch)
        .eq("id", params.id)
        .eq("company_id", companyId)
        .select("id, company_id, location_id, employee_id, role_id, start_at, end_at, break_minutes, hourly_wage, notes, created_by, created_at, updated_at")
        .single();
    }

    if (result.error) {
      throw new HttpError(400, result.error.message);
    }

    return jsonOk(result.data);
  } catch (error) {
    return handleRouteError(error);
  }
}
