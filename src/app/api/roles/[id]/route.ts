import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const paramsSchema = z.object({ id: z.string().uuid() });

const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    hourly_wage_default: z
      .preprocess(
        (value) => (value === null || value === undefined || value === "" ? null : value),
        z.coerce.number().min(0).max(9999999999.99).nullable(),
      )
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const params = paramsSchema.parse(await context.params);
    const body = await parseJson(request, updateRoleSchema);

    const { data, error } = await supabase
      .from("roles")
      .update(body)
      .eq("id", params.id)
      .eq("company_id", companyId)
      .select("id, company_id, name, hourly_wage_default, created_at, updated_at")
      .maybeSingle();

    if (error) {
      throw new HttpError(400, error.message);
    }

    if (!data) {
      throw new HttpError(404, "Role not found");
    }

    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
