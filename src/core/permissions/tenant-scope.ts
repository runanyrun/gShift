import { TypedSupabaseClient } from "../db/supabase";
import { getCurrentUserTenantContextOrThrow } from "../auth/current-user";

type QueryWithEq<T> = {
  eq(column: string, value: string): T;
};

export function withCompanyScope<T extends QueryWithEq<T>>(
  query: T,
  companyId: string,
  column: string = "company_id",
): T {
  return query.eq(column, companyId);
}

export async function withCurrentCompanyScope<T extends QueryWithEq<T>>(
  supabase: TypedSupabaseClient,
  query: T,
): Promise<{ query: T; companyId: string; role: string }> {
  const context = await getCurrentUserTenantContextOrThrow(supabase);
  return {
    query: withCompanyScope(query, context.companyId),
    companyId: context.companyId,
    role: context.role,
  };
}
