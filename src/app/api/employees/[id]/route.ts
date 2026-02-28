import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const paramsSchema = z.object({ id: z.string().uuid() });

const updateEmployeeSchema = z
  .object({
    location_id: z.string().uuid().optional(),
    role_id: z.string().uuid().optional(),
    full_name: z.string().trim().min(1).max(160).optional(),
    active: z.boolean().optional(),
    hourly_rate: z
      .preprocess(
        (value) => (value === null || value === undefined || value === "" ? null : value),
        z.coerce.number().min(0).max(9999999999.99).nullable(),
      )
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);
    const params = paramsSchema.parse(await context.params);

    const { data, error } = await supabase
      .from("employees")
      .select("id, company_id, location_id, role_id, full_name, active, hourly_rate, created_at, updated_at")
      .eq("id", params.id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) {
      throw new HttpError(400, error.message);
    }

    if (!data) {
      throw new HttpError(404, "Employee not found");
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
    const body = await parseJson(request, updateEmployeeSchema);

    const { data, error } = await supabase
      .from("employees")
      .update(body)
      .eq("id", params.id)
      .eq("company_id", companyId)
      .select("id, company_id, location_id, role_id, full_name, active, hourly_rate, created_at, updated_at")
      .maybeSingle();

    if (error) {
      throw new HttpError(400, error.message);
    }

    if (!data) {
      throw new HttpError(404, "Employee not found");
    }

    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
