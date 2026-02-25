import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk, parseJson } from "../../../../lib/http";

const bodySchema = z.object({
  locations: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        timezone: z.string().trim().min(1).max(120).default("Europe/Istanbul"),
      }),
    )
    .min(1),
});

type LocationRow = { id: string; name: string; timezone: string };

function keyOf(name: string, timezone: string) {
  return `${name.trim().toLocaleLowerCase("tr-TR")}::${timezone.trim()}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);
    const body = await parseJson(request, bodySchema);

    const normalized = body.locations.map((item) => ({
      name: item.name.trim(),
      timezone: item.timezone.trim(),
    }));

    const requestedKeys = new Set(normalized.map((item) => keyOf(item.name, item.timezone)));

    const { data: existingRows, error: existingError } = await supabase
      .from("locations")
      .select("id, name, timezone")
      .eq("company_id", companyId);

    if (existingError) {
      throw new HttpError(400, existingError.message);
    }

    const existing = (existingRows ?? []) as LocationRow[];
    const existingKeySet = new Set(existing.map((row) => keyOf(row.name, row.timezone)));

    const seenPayloadKeys = new Set<string>();
    const toInsert = normalized.filter((item) => {
      const key = keyOf(item.name, item.timezone);
      if (seenPayloadKeys.has(key)) {
        return false;
      }
      seenPayloadKeys.add(key);
      return !existingKeySet.has(key);
    });

    let inserted: LocationRow[] = [];

    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from("locations")
        .insert(toInsert.map((item) => ({ company_id: companyId, name: item.name, timezone: item.timezone })))
        .select("id, name, timezone");

      if (error) {
        throw new HttpError(400, error.message);
      }

      inserted = (data ?? []) as LocationRow[];
    }

    const responseRows = [...existing.filter((row) => requestedKeys.has(keyOf(row.name, row.timezone))), ...inserted];

    return jsonOk(responseRows, inserted.length > 0 ? 201 : 200);
  } catch (error) {
    return handleRouteError(error);
  }
}
