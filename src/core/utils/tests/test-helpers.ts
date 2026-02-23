/**
 * Test helper utilities
 * Run tests with: npm run test:all
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";
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

export interface OwnerTenantFixture extends TenantContext {
  email: string;
  password: string;
}

export interface InvitedEmployeeFixture extends TenantContext {
  employeeId: string;
  email: string;
  password: string;
}

export interface TenantMemberFixture extends TenantContext {
  email: string;
  password: string;
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

export function makeUniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}@example.test`;
}

export async function createOwnerTenantFixture(params: {
  companyName: string;
  firstName: string;
  lastName: string;
  emailPrefix?: string;
  password?: string;
}): Promise<OwnerTenantFixture> {
  const email = makeUniqueEmail(params.emailPrefix ?? "owner");
  const password = params.password ?? "OwnerTest123!";
  const authClient = createAuthClient();

  const { error: signUpError } = await authClient.auth.signUp({ email, password });
  if (signUpError) {
    fail(`Failed to sign up owner fixture user: ${signUpError.message}`);
  }

  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.user || !signInData.session?.access_token) {
    fail(`Failed to sign in owner fixture user: ${signInError?.message ?? "unknown"}`);
  }

  const scopedClient = createSupabaseClientWithAccessToken(signInData.session.access_token);
  const { error: onboardingError } = await scopedClient.rpc("complete_owner_onboarding", {
    p_auth_user_id: signInData.user.id,
    p_email: email,
    p_first_name: params.firstName,
    p_last_name: params.lastName,
    p_company_name: params.companyName,
    p_sector: null,
    p_country_code: null,
    p_currency_code: null,
    p_timezone: null,
    p_plan_type: null,
    p_subscription_status: null,
  });
  if (onboardingError) {
    fail(`Failed to complete owner onboarding fixture: ${onboardingError.message}`);
  }

  const { data: profile, error: profileError } = await scopedClient
    .from("users")
    .select("id, company_id")
    .eq("auth_user_id", signInData.user.id)
    .single();
  if (profileError || !profile) {
    fail(`Failed to load owner profile fixture: ${profileError?.message ?? "unknown"}`);
  }

  return {
    email,
    password,
    accessToken: signInData.session.access_token,
    authUserId: signInData.user.id,
    companyId: profile.company_id,
    profileId: profile.id,
  };
}

export async function createInvitedEmployeeFixture(params: {
  owner: OwnerTenantFixture;
  firstName: string;
  lastName: string;
  emailPrefix?: string;
  password?: string;
}): Promise<InvitedEmployeeFixture> {
  const email = makeUniqueEmail(params.emailPrefix ?? "employee");
  const password = params.password ?? "EmployeeTest123!";
  const ownerClient = createSupabaseClientWithAccessToken(params.owner.accessToken);

  const { data: employee, error: employeeError } = await ownerClient
    .from("employees")
    .insert({
      tenant_id: params.owner.companyId,
      first_name: params.firstName,
      last_name: params.lastName,
      email,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (employeeError || !employee) {
    fail(`Failed to create employee fixture: ${employeeError?.message ?? "unknown"}`);
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { error: inviteError } = await ownerClient.from("employee_invites").insert({
    tenant_id: params.owner.companyId,
    employee_id: employee.id,
    email,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: "pending",
    created_by: params.owner.authUserId,
    created_at: new Date().toISOString(),
  });
  if (inviteError) {
    fail(`Failed to create employee invite fixture: ${inviteError.message}`);
  }

  const authClient = createAuthClient();
  const { error: signUpError } = await authClient.auth.signUp({ email, password });
  if (signUpError) {
    fail(`Failed to sign up employee fixture user: ${signUpError.message}`);
  }

  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.user || !signInData.session?.access_token) {
    fail(`Failed to sign in employee fixture user: ${signInError?.message ?? "unknown"}`);
  }

  const employeeClient = createSupabaseClientWithAccessToken(signInData.session.access_token);
  const { error: acceptError } = await employeeClient.rpc("accept_employee_invite", {
    p_raw_token: rawToken,
  });
  if (acceptError) {
    fail(`Failed to accept employee invite fixture: ${acceptError.message}`);
  }

  const { data: profile, error: profileError } = await employeeClient
    .from("users")
    .select("id, company_id")
    .eq("auth_user_id", signInData.user.id)
    .single();
  if (profileError || !profile) {
    fail(`Failed to load employee profile fixture: ${profileError?.message ?? "unknown"}`);
  }

  return {
    employeeId: employee.id,
    email,
    password,
    accessToken: signInData.session.access_token,
    authUserId: signInData.user.id,
    companyId: profile.company_id,
    profileId: profile.id,
  };
}

export async function createTenantMemberFixture(params: {
  companyId: string;
  role?: "owner" | "admin" | "manager" | "employee";
  emailPrefix?: string;
  password?: string;
}): Promise<TenantMemberFixture> {
  const email = makeUniqueEmail(params.emailPrefix ?? "tenant-member");
  const password = params.password ?? "TenantMember123!";
  const role = params.role ?? "owner";

  const authClient = createAuthClient();
  const { error: signUpError } = await authClient.auth.signUp({ email, password });
  if (signUpError) {
    fail(`Failed to sign up tenant member fixture: ${signUpError.message}`);
  }

  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.user || !signInData.session?.access_token) {
    fail(`Failed to sign in tenant member fixture: ${signInError?.message ?? "unknown"}`);
  }

  const scopedClient = createSupabaseClientWithAccessToken(signInData.session.access_token);
  const { data: profile, error: profileError } = await scopedClient
    .from("users")
    .insert({
      auth_user_id: signInData.user.id,
      company_id: params.companyId,
      email,
      role,
      created_at: new Date().toISOString(),
    })
    .select("id, company_id")
    .single();
  if (profileError || !profile) {
    fail(`Failed to insert tenant member profile fixture: ${profileError?.message ?? "unknown"}`);
  }

  return {
    email,
    password,
    accessToken: signInData.session.access_token,
    authUserId: signInData.user.id,
    companyId: profile.company_id,
    profileId: profile.id,
  };
}
