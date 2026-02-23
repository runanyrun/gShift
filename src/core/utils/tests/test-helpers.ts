/**
 * Test helper utilities
 * Run tests with: npm run test:all
 */
import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env";
import { createSupabaseClientWithAccessToken } from "../../db/supabase";

export interface Credentials {
  email: string;
  password: string;
}

export interface TenantContext {
  accessToken: string;
  authUserId: string;
  companyId: string;
  profileId: string;
}

export function pass(message: string) {
  console.log(`PASS: ${message}`);
}

export function skip(message: string): never {
  console.log(`SKIP: ${message}`);
  process.exit(0);
}

export function fail(message: string): never {
  throw new Error(`FAIL: ${message}`);
}

const MIGRATION_0005_RELATIONS = [
  "public.employees",
  "employees",
  "public.job_titles",
  "job_titles",
  "public.departments",
  "departments",
  "public.locations",
  "locations",
  "public.employee_invites",
  "employee_invites",
  "public.employee_locations",
  "employee_locations",
];

export function isMissingRelationError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  const normalizedMessage = message.toLowerCase();
  const isMissingRelationMessage =
    normalizedMessage.includes("does not exist") ||
    normalizedMessage.includes("could not find the table");

  if (!isMissingRelationMessage) {
    return false;
  }

  return MIGRATION_0005_RELATIONS.some((relation) => normalizedMessage.includes(relation));
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    fail(`Missing environment variable: ${name}`);
  }

  return value;
}

export function createAuthClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function signIn(credentials: Credentials): Promise<TenantContext> {
  const authClient = createAuthClient();
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword(
    credentials,
  );
  if (authError || !authData.user || !authData.session?.access_token) {
    fail(`Sign in failed for ${credentials.email}: ${authError?.message ?? "unknown"}`);
  }

  const scopedClient = createSupabaseClientWithAccessToken(authData.session.access_token);
  const { data: profile, error: profileError } = await scopedClient
    .from("users")
    .select("id, company_id")
    .eq("auth_user_id", authData.user.id)
    .single();

  if (profileError || !profile) {
    fail(`Profile lookup failed for ${credentials.email}: ${profileError?.message ?? "unknown"}`);
  }

  return {
    accessToken: authData.session.access_token,
    authUserId: authData.user.id,
    companyId: profile.company_id,
    profileId: profile.id,
  };
}
