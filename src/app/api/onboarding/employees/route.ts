import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";
import { normalizeName, normalizeRate } from "../../../../lib/normalize";

const bodySchema = z.object({
  employees: z
    .array(
      z.object({
        full_name: z.string().trim().min(1).max(160),
        location_id: z.string().uuid(),
        role_id: z.string().uuid(),
        hourly_rate: z.preprocess((value) => normalizeRate(value), z.number().min(0).nullable()),
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

function keyOf(fullName: string, locationId: string) {
  return `${normalizeName(fullName).toLocaleLowerCase("tr-TR")}::${locationId}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);
    const body = await parseJson(request, bodySchema);

    const normalized = body.employees.map((item) => ({
      full_name: normalizeName(item.full_name),
      location_id: item.location_id,
      role_id: item.role_id,
      hourly_rate: normalizeRate(item.hourly_rate),
    }));

    const { data: existingRows, error: existingError } = await supabase
      .from("employees")
      .select("id, full_name, location_id, role_id, hourly_rate")
      .eq("company_id", companyId);

    if (existingError) {
      throw new HttpError(400, existingError.message);
    }

    const existing = (existingRows ?? []) as EmployeeRow[];
    const existingByKey = new Map(existing.map((row) => [keyOf(row.full_name, row.location_id), row]));

    const seenPayloadKeys = new Set<string>();
    const deduped = normalized.filter((item) => {
      const key = keyOf(item.full_name, item.location_id);
      if (seenPayloadKeys.has(key)) {
        return false;
      }
      seenPayloadKeys.add(key);
      return true;
    });

    const toInsert = deduped.filter((item) => !existingByKey.has(keyOf(item.full_name, item.location_id)));
    const toUpdate = deduped.filter((item) => existingByKey.has(keyOf(item.full_name, item.location_id)));

    let inserted: EmployeeRow[] = [];
    let updated: EmployeeRow[] = [];

    if (toUpdate.length > 0) {
      const updateResults = await Promise.all(
        toUpdate.map(async (item) => {
          const existingRow = existingByKey.get(keyOf(item.full_name, item.location_id));
          if (!existingRow) {
            return null;
          }

          const { data, error } = await supabase
            .from("employees")
            .update({
              role_id: item.role_id,
              hourly_rate: item.hourly_rate,
            })
            .eq("company_id", companyId)
            .eq("id", existingRow.id)
            .select("id, full_name, location_id, role_id, hourly_rate")
            .single();

          if (error) {
            throw new HttpError(400, error.message);
          }

          return data as EmployeeRow;
        }),
      );

      updated = updateResults.filter((row): row is EmployeeRow => row !== null);
    }

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
          })),
        )
        .select("id, full_name, location_id, role_id, hourly_rate");

      if (error) {
        throw new HttpError(400, error.message);
      }

      inserted = (data ?? []) as EmployeeRow[];
    }

    const responseRows = [...updated, ...inserted];

    return jsonOk(responseRows, inserted.length > 0 ? 201 : 200);
  } catch (error) {
    return handleRouteError(error);
  }
}
