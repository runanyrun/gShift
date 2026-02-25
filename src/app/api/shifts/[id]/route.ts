import { z } from "zod";
import { getServerSupabase, requireCompanyId, requireUser } from "../../../../lib/auth";
import { handleRouteError, HttpError, jsonOk } from "../../../../lib/http";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const params = paramsSchema.parse(await context.params);

    const { data, error } = await supabase
      .from("shifts")
      .delete()
      .eq("id", params.id)
      .eq("company_id", companyId)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new HttpError(400, error.message);
    }

    if (!data) {
      throw new HttpError(404, "Shift not found");
    }

    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
