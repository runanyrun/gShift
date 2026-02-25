import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk } from "../../../../lib/http";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locationId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    await requireCompanyId(supabase);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      locationId: url.searchParams.get("locationId") ?? undefined,
    });

    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query parameters");
    }

    const { data, error } = await supabase.rpc("get_hours_cost_report", {
      from_date: parsed.data.from,
      to_date: parsed.data.to,
      location_id: parsed.data.locationId ?? null,
    });

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk(data ?? {
      from: parsed.data.from,
      to: parsed.data.to,
      location_id: parsed.data.locationId ?? null,
      totals: { total_hours: 0, total_cost: 0 },
      per_employee: [],
      per_location: [],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
