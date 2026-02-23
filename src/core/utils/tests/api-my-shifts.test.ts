/**
 * Local test setup:
 * 1. Copy `.env.test.local.example` -> `.env.test.local`
 * 2. Fill TENANT_A/B credentials
 * 3. Run: npm run test:api-my-shifts
 */
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseClientWithAccessToken } from "../../db/supabase";
import { env } from "../../config/env";
import { fail, pass, requireEnv, signIn, skip } from "./test-helpers";

interface ApiMyShiftsResponse {
  ok: boolean;
  data?: Array<{
    id: string;
    company_id: string;
    user_id: string;
    starts_at: string;
    ends_at: string;
  }>;
  error?: { message?: string; code?: string } | string;
}

async function createLinkedEmployeeViaInvite(params: {
  managementClient: ReturnType<typeof createSupabaseClientWithAccessToken>;
  managementAuthUserId: string;
  companyId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const {
    managementClient,
    managementAuthUserId,
    companyId,
    email,
    password,
    firstName,
    lastName,
  } = params;

  const { data: employee, error: employeeError } = await managementClient
    .from("employees")
    .insert({
      tenant_id: companyId,
      first_name: firstName,
      last_name: lastName,
      email,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (employeeError || !employee) {
    fail(`Failed to create API test employee: ${employeeError?.message ?? "unknown"}`);
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { error: inviteError } = await managementClient.from("employee_invites").insert({
    tenant_id: companyId,
    employee_id: employee.id,
    email,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: "pending",
    created_by: managementAuthUserId,
    created_at: new Date().toISOString(),
  });
  if (inviteError) {
    fail(`Failed to create API invite: ${inviteError.message}`);
  }

  const authClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signUpError } = await authClient.auth.signUp({ email, password });
  if (signUpError) {
    fail(`Failed to sign up API user (${email}): ${signUpError.message}`);
  }

  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.user || !signInData.session?.access_token) {
    fail(`Failed to sign in API user (${email}): ${signInError?.message ?? "unknown"}`);
  }

  const scoped = createSupabaseClientWithAccessToken(signInData.session.access_token);
  const { error: acceptError } = await scoped.rpc("accept_employee_invite", { p_raw_token: rawToken });
  if (acceptError) {
    fail(`Failed to accept API invite: ${acceptError.message}`);
  }

  const { data: profile, error: profileError } = await scoped
    .from("users")
    .select("id, company_id")
    .eq("auth_user_id", signInData.user.id)
    .single();
  if (profileError || !profile) {
    fail(`Failed to load API profile: ${profileError?.message ?? "unknown"}`);
  }

  return {
    authUserId: signInData.user.id,
    accessToken: signInData.session.access_token,
    profileId: profile.id,
    companyId: profile.company_id,
  };
}

async function requestMyShifts(baseUrl: string, accessToken?: string) {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${baseUrl}/api/my/shifts?days=7`, {
    method: "GET",
    headers,
  });
  const body = (await response.json()) as ApiMyShiftsResponse;
  return { response, body };
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
  const tenantA = await signIn({
    email: requireEnv("TENANT_A_EMAIL"),
    password: requireEnv("TENANT_A_PASSWORD"),
  });
  const tenantB = await signIn({
    email: requireEnv("TENANT_B_EMAIL"),
    password: requireEnv("TENANT_B_PASSWORD"),
  });
  const tenantAClient = createSupabaseClientWithAccessToken(tenantA.accessToken);
  const tenantBClient = createSupabaseClientWithAccessToken(tenantB.accessToken);

  const { data: managementAllowed, error: managementError } = await tenantAClient.rpc(
    "is_management_user",
  );
  if (managementError) {
    fail(`is_management_user preflight failed: ${managementError.message}`);
  }
  if (!managementAllowed) {
    const unauthorized = await requestMyShifts(baseUrl);
    if (unauthorized.response.status !== 401) {
      fail(
        `Expected 401 for missing access token on /api/my/shifts, got ${unauthorized.response.status}`,
      );
    }
    pass("/api/my/shifts enforces bearer auth for unauthenticated requests.");
    skip(
      "Full /api/my/shifts success-path coverage requires a management test account to create invite-linked employee fixtures.",
    );
  }

  const linkedEmployee = await createLinkedEmployeeViaInvite({
    managementClient: tenantAClient,
    managementAuthUserId: tenantA.authUserId,
    companyId: tenantA.companyId,
    email: `api-my-shifts-${Date.now()}@example.test`,
    password: "ApiMyShift123!",
    firstName: "Api",
    lastName: "Employee",
  });

  const now = new Date();
  const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const inEightDays = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const { error: seedError } = await tenantAClient.from("shifts").insert([
    {
      company_id: tenantA.companyId,
      user_id: linkedEmployee.profileId,
      starts_at: inOneDay.toISOString(),
      ends_at: new Date(inOneDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_by: tenantA.authUserId,
    },
    {
      company_id: tenantA.companyId,
      user_id: linkedEmployee.profileId,
      starts_at: inEightDays.toISOString(),
      ends_at: new Date(inEightDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_by: tenantA.authUserId,
    },
  ]);
  if (seedError) {
    fail(`Failed to seed API shifts: ${seedError.message}`);
  }

  const { error: crossTenantSeedError } = await tenantBClient.from("shifts").insert({
    company_id: tenantB.companyId,
    user_id: tenantB.profileId,
    starts_at: inTwoDays.toISOString(),
    ends_at: new Date(inTwoDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    created_by: tenantB.authUserId,
  });
  if (crossTenantSeedError) {
    fail(`Failed to seed cross-tenant shift: ${crossTenantSeedError.message}`);
  }

  const authorized = await requestMyShifts(baseUrl, linkedEmployee.accessToken);
  if (authorized.response.status !== 200 || !authorized.body.ok || !authorized.body.data) {
    fail(
      `Expected authorized /api/my/shifts response. status=${authorized.response.status}, body=${JSON.stringify(authorized.body)}`,
    );
  }
  if (authorized.body.data.length !== 1) {
    fail(`Expected exactly 1 upcoming shift, got ${authorized.body.data.length}`);
  }
  if (authorized.body.data[0].company_id !== tenantA.companyId) {
    fail("API returned cross-tenant shift row.");
  }
  pass("/api/my/shifts returns only upcoming shifts for the logged-in employee.");

  const unlinkedEmail = `api-unlinked-${Date.now()}@example.test`;
  const unlinkedPassword = "ApiUnlinked123!";
  const authClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: unlinkedSignUpError } = await authClient.auth.signUp({
    email: unlinkedEmail,
    password: unlinkedPassword,
  });
  if (unlinkedSignUpError) {
    fail(`Failed to sign up unlinked API user: ${unlinkedSignUpError.message}`);
  }
  const { data: unlinkedSignInData, error: unlinkedSignInError } = await authClient.auth.signInWithPassword({
    email: unlinkedEmail,
    password: unlinkedPassword,
  });
  if (unlinkedSignInError || !unlinkedSignInData.session?.access_token) {
    fail(`Failed to sign in unlinked API user: ${unlinkedSignInError?.message ?? "unknown"}`);
  }

  const unlinkedResponse = await requestMyShifts(baseUrl, unlinkedSignInData.session.access_token);
  if (unlinkedResponse.response.status !== 403 || unlinkedResponse.body.ok !== false) {
    fail(
      `Expected 403 for unlinked user /api/my/shifts. status=${unlinkedResponse.response.status}, body=${JSON.stringify(unlinkedResponse.body)}`,
    );
  }
  pass("/api/my/shifts rejects users without tenant/employee linkage.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
