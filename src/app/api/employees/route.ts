import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../lib/http";

const createEmployeeSchema = z.object({
  location_id: z.string().uuid(),
  role_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(160),
  active: z.boolean().optional(),
  hourly_rate: z
    .preprocess(
      (value) => (value === null || value === undefined || value === "" ? null : value),
      z.coerce.number().min(0).max(9999999999.99).nullable(),
    )
    .optional(),
});

const listEmployeesQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const url = new URL(request.url);
    const parsed = listEmployeesQuerySchema.safeParse({
      locationId: url.searchParams.get("locationId") ?? undefined,
    });

    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query parameters");
    }

    let query = supabase
      .from("employees")
      .select("id, company_id, location_id, role_id, full_name, active, hourly_rate, created_at, updated_at")
      .eq("company_id", companyId)
      .order("full_name", { ascending: true });

    if (parsed.data.locationId) {
      query = query.eq("location_id", parsed.data.locationId);
    }

    const { data, error } = await query;

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

    const body = await parseJson(request, createEmployeeSchema);

    const { data, error } = await supabase
      .from("employees")
      .insert({
        company_id: companyId,
        location_id: body.location_id,
        role_id: body.role_id,
        full_name: body.full_name,
        active: body.active ?? true,
        hourly_rate: body.hourly_rate ?? null,
      })
      .select("id, company_id, location_id, role_id, full_name, active, hourly_rate, created_at, updated_at")
      .single();

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
