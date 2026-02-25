import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../lib/http";

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  hourly_wage_default: z
    .preprocess(
      (value) => (value === null || value === undefined || value === "" ? null : value),
      z.coerce.number().min(0).max(9999999999.99).nullable(),
    )
    .optional(),
});

export async function GET() {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const { data, error } = await supabase
      .from("roles")
      .select("id, company_id, name, hourly_wage_default, created_at, updated_at")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk(data ?? []);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const body = await parseJson(request, createRoleSchema);

    const { data, error } = await supabase
      .from("roles")
      .insert({
        company_id: companyId,
        name: body.name,
        hourly_wage_default: body.hourly_wage_default ?? null,
      })
      .select("id, company_id, name, hourly_wage_default, created_at, updated_at")
      .single();

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
