import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../lib/auth";
import { handleRouteError, HttpError, jsonOk } from "../../../lib/http";

const querySchema = z.object({
  locationId: z.string().uuid(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    await requireCompanyId(supabase);

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      locationId: url.searchParams.get("locationId"),
      weekStart: url.searchParams.get("weekStart"),
    });

    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query parameters");
    }

    const { data, error } = await supabase.rpc("get_shifts_for_week", {
      location_id: parsed.data.locationId,
      week_start: parsed.data.weekStart,
    });

    if (error) {
      throw new HttpError(400, error.message);
    }

    return jsonOk(data ?? []);
  } catch (error) {
    return handleRouteError(error);
  }
}
