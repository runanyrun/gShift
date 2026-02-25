import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";
import { normalizeName, normalizeRate } from "../../../../lib/normalize";

const bodySchema = z.object({
  roles: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        hourly_wage_default: z.preprocess((value) => normalizeRate(value), z.number().min(0).nullable()),
      }),
    )
    .min(1),
});

type RoleRow = { id: string; name: string; hourly_wage_default: number | null };

function keyOf(name: string) {
  return name.trim().toLocaleLowerCase("tr-TR");
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);
    const body = await parseJson(request, bodySchema);

    const normalized = body.roles.map((item) => ({
      name: normalizeName(item.name),
      hourly_wage_default: normalizeRate(item.hourly_wage_default),
    }));

    const requestedKeys = new Set(normalized.map((item) => keyOf(item.name)));

    const { data: existingRows, error: existingError } = await supabase
      .from("roles")
      .select("id, name, hourly_wage_default")
      .eq("company_id", companyId);

    if (existingError) {
      throw new HttpError(400, existingError.message);
    }

    const existing = (existingRows ?? []) as RoleRow[];
    const existingKeySet = new Set(existing.map((row) => keyOf(row.name)));

    const seenPayloadKeys = new Set<string>();
    const toInsert = normalized.filter((item) => {
      const key = keyOf(item.name);
      if (seenPayloadKeys.has(key)) {
        return false;
      }
      seenPayloadKeys.add(key);
      return !existingKeySet.has(key);
    });

    let inserted: RoleRow[] = [];

    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from("roles")
        .insert(toInsert.map((item) => ({ company_id: companyId, name: item.name, hourly_wage_default: item.hourly_wage_default })))
        .select("id, name, hourly_wage_default");

      if (error) {
        throw new HttpError(400, error.message);
      }

      inserted = (data ?? []) as RoleRow[];
    }

    const responseRows = [...existing.filter((row) => requestedKeys.has(keyOf(row.name))), ...inserted];

    return jsonOk(responseRows, inserted.length > 0 ? 201 : 200);
  } catch (error) {
    return handleRouteError(error);
  }
}
