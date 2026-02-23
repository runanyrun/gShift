import { TypedSupabaseClient } from "../db/supabase";
import { UserRole } from "../db/database.types";

export interface AuthenticatedUserContext {
  authUserId: string;
  companyId: string;
  role: UserRole;
}

export async function getCurrentUserId(
  supabase: TypedSupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(`Failed to load authenticated user: ${error.message}`);
  }
  return data.user?.id ?? null;
}

export async function getCurrentUserTenantContext(
  supabase: TypedSupabaseClient,
): Promise<AuthenticatedUserContext | null> {
  const authUserId = await getCurrentUserId(supabase);
  if (!authUserId) {
    return null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("auth_user_id, company_id, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user tenant context: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    authUserId: data.auth_user_id,
    companyId: data.company_id,
    role: data.role,
  };
}

export async function getCurrentUserTenantContextOrThrow(
  supabase: TypedSupabaseClient,
): Promise<AuthenticatedUserContext> {
  const context = await getCurrentUserTenantContext(supabase);
  if (!context) {
    throw new Error("Authenticated user context was not found.");
  }
  return context;
}
