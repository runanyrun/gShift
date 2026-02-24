import { TypedSupabaseClient } from "../db/supabase";

export async function getActiveCompanyId(supabase: TypedSupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("current_user_company_id");
  if (error || !data) {
    throw new Error(`Failed to resolve active company: ${error?.message ?? "not found"}`);
  }
  return data;
}
