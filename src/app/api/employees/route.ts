import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../lib/auth";
import { handleRouteError, HttpError, jsonOk } from "../../../lib/http";
import { normalizeName, normalizeRate } from "../../../lib/normalize";

const listEmployeesQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
});

const batchSchema = z.object({
  employees: z
    .array(
      z.object({
        location_id: z.string().uuid(),
        role_id: z.string().uuid(),
        full_name: z.string().trim().min(1).max(160),
        hourly_rate: z.preprocess((value) => normalizeRate(value), z.number().min(0).nullable()),
      }),
    )
    .min(1),
});

const singleSchema = z.object({
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  full_name: z.string().trim().max(160).optional(),
  location_id: z.string().uuid(),
  role_id: z.string().uuid(),
  hourly_rate: z.preprocess((value) => normalizeRate(value), z.number().min(0).nullable()).optional(),
  active: z.boolean().optional(),
});

type EmployeeRow = {
  id: string;
  full_name: string;
  location_id: string;
  role_id: string;
  hourly_rate: number | null;
  active: boolean;
};

function keyOf(fullName: string, locationId: string) {
  return `${normalizeName(fullName).toLocaleLowerCase("tr-TR")}::${locationId}`;
}

function resolveFullName(body: z.infer<typeof singleSchema>) {
  const fullName =
    body.full_name?.trim()
    || `${body.firstName?.trim() ?? ""} ${body.lastName?.trim() ?? ""}`.trim();

  return normalizeName(fullName);
}

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
    const rawBody = (await request.json()) as unknown;

    const parsedBatch = batchSchema.safeParse(rawBody);
    if (parsedBatch.success) {
      const normalized = parsedBatch.data.employees.map((item) => ({
        full_name: normalizeName(item.full_name),
        location_id: item.location_id,
        role_id: item.role_id,
        hourly_rate: normalizeRate(item.hourly_rate),
      }));

      const { data: existingRows, error: existingError } = await supabase
        .from("employees")
        .select("id, full_name, location_id, role_id, hourly_rate, active")
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

      let updated: EmployeeRow[] = [];
      let inserted: EmployeeRow[] = [];

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
                active: true,
              })
              .eq("company_id", companyId)
              .eq("id", existingRow.id)
              .select("id, full_name, location_id, role_id, hourly_rate, active")
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
              location_id: item.location_id,
              role_id: item.role_id,
              full_name: item.full_name,
              hourly_rate: item.hourly_rate,
              active: true,
            })),
          )
          .select("id, full_name, location_id, role_id, hourly_rate, active");

        if (error) {
          throw new HttpError(400, error.message);
        }

        inserted = (data ?? []) as EmployeeRow[];
      }

      return jsonOk([...updated, ...inserted], inserted.length > 0 ? 201 : 200);
    }

    const parsedSingle = singleSchema.safeParse(rawBody);
    if (!parsedSingle.success) {
      throw new HttpError(400, parsedSingle.error.issues[0]?.message ?? "Invalid employee payload");
    }

    const fullName = resolveFullName(parsedSingle.data);
    if (!fullName) {
      throw new HttpError(400, "Employee name is required");
    }

    const { data, error } = await supabase
      .from("employees")
      .insert({
        company_id: companyId,
        full_name: fullName,
        location_id: parsedSingle.data.location_id,
        role_id: parsedSingle.data.role_id,
        hourly_rate: normalizeRate(parsedSingle.data.hourly_rate ?? null),
        active: parsedSingle.data.active ?? true,
      })
      .select("id")
      .single();

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
