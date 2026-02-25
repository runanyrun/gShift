import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const bodySchema = z.object({
  employees: z
    .array(
      z.object({
        full_name: z.string().trim().min(1).max(160),
        location_id: z.string().uuid(),
        role_id: z.string().uuid(),
        hourly_rate: z.number().min(0).optional().nullable(),
      }),
    )
    .min(1),
});

type EmployeeRow = {
  id: string;
  full_name: string;
  location_id: string;
  role_id: string;
  hourly_rate: number | null;
};

function keyOf(fullName: string, locationId: string, roleId: string) {
  return `${fullName.trim().toLocaleLowerCase("tr-TR")}::${locationId}::${roleId}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);
    const body = await parseJson(request, bodySchema);

    const normalized = body.employees.map((item) => ({
      full_name: item.full_name.trim(),
      location_id: item.location_id,
      role_id: item.role_id,
      hourly_rate: item.hourly_rate ?? null,
    }));

    const requestedKeys = new Set(normalized.map((item) => keyOf(item.full_name, item.location_id, item.role_id)));
    const locationIds = [...new Set(normalized.map((item) => item.location_id))];
    const roleIds = [...new Set(normalized.map((item) => item.role_id))];
    const names = [...new Set(normalized.map((item) => item.full_name))];

    const { data: existingRows, error: existingError } = await supabase
      .from("employees")
      .select("id, full_name, location_id, role_id, hourly_rate")
      .eq("company_id", companyId)
      .in("location_id", locationIds)
      .in("role_id", roleIds)
      .in("full_name", names);

    if (existingError) {
      throw new HttpError(400, existingError.message);
    }

    const existing = (existingRows ?? []) as EmployeeRow[];
    const existingKeySet = new Set(existing.map((row) => keyOf(row.full_name, row.location_id, row.role_id)));

    const seenPayloadKeys = new Set<string>();
    const toInsert = normalized.filter((item) => {
      const key = keyOf(item.full_name, item.location_id, item.role_id);
      if (seenPayloadKeys.has(key)) {
        return false;
      }
      seenPayloadKeys.add(key);
      return !existingKeySet.has(key);
    });

    let inserted: EmployeeRow[] = [];

    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from("employees")
        .insert(
          toInsert.map((item) => ({
            company_id: companyId,
            full_name: item.full_name,
            location_id: item.location_id,
            role_id: item.role_id,
            hourly_rate: item.hourly_rate,
            active: true,
          })),
        )
        .select("id, full_name, location_id, role_id, hourly_rate");

      if (error) {
        throw new HttpError(400, error.message);
      }

      inserted = (data ?? []) as EmployeeRow[];
    }

    const responseRows = [
      ...existing.filter((row) => requestedKeys.has(keyOf(row.full_name, row.location_id, row.role_id))),
      ...inserted,
    ];

    return jsonOk(responseRows, inserted.length > 0 ? 201 : 200);
  } catch (error) {
    return handleRouteError(error);
  }
}
