import { getServerSupabase, requireCompanyId, requireUser } from "../../../lib/auth";
import { handleRouteError, jsonOk, HttpError } from "../../../lib/http";

export async function GET() {
  try {
    const supabase = await getServerSupabase();
    await requireUser(supabase);
    const companyId = await requireCompanyId(supabase);

    const { data, error } = await supabase
      .from("locations")
      .select("id, company_id, name, timezone, created_at, updated_at")
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
