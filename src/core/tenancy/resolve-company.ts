import { TypedSupabaseClient } from "../db/supabase";

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export async function resolveCompanyBySlug(
  supabase: TypedSupabaseClient,
  slug: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug")
    .ilike("slug", normalizedSlug)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to resolve company by slug: ${error.message}`);
  }

  return data
    ? {
        id: data.id,
        name: data.name,
        slug: data.slug,
      }
    : null;
}

export async function resolveCurrentCompanySlug(
  supabase: TypedSupabaseClient,
): Promise<string | null> {
  const { data: companyId, error: companyIdError } = await supabase.rpc("current_user_company_id");
  if (companyIdError || !companyId) {
    throw new Error(`Failed to resolve current company id: ${companyIdError?.message ?? "not found"}`);
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("slug")
    .eq("id", companyId)
    .single();

  if (companyError) {
    throw new Error(`Failed to resolve current company slug: ${companyError.message}`);
  }

  return company?.slug ?? null;
}
