import { TypedSupabaseClient } from "../db/supabase";

export interface WorkspaceMembership {
  companyId: string;
  role: "owner" | "admin" | "manager" | "employee";
  status: "active" | "inactive";
  companyName: string | null;
  companySlug: string | null;
}

export async function listMyCompanyMemberships(
  supabase: TypedSupabaseClient,
  authUserId: string,
): Promise<WorkspaceMembership[]> {
  const { data: memberships, error: membershipsError } = await supabase
    .from("company_memberships")
    .select("company_id, role, status")
    .eq("auth_user_id", authUserId);

  if (membershipsError) {
    throw new Error(`Failed to list memberships: ${membershipsError.message}`);
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const companyIds = Array.from(new Set(memberships.map((row) => row.company_id)));
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, slug")
    .in("id", companyIds);

  if (companiesError) {
    throw new Error(`Failed to load workspace details: ${companiesError.message}`);
  }

  const companyMap = new Map(
    (companies ?? []).map((company) => [company.id, { name: company.name, slug: company.slug }]),
  );

  return memberships.map((membership) => ({
    companyId: membership.company_id,
    role: membership.role,
    status: membership.status,
    companyName: companyMap.get(membership.company_id)?.name ?? null,
    companySlug: companyMap.get(membership.company_id)?.slug ?? null,
  }));
}
