/**
 * Deterministic core API test (no external seed dependency):
 * 1. Run: npm run test:api-my-shifts
 */
import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env";
import { createSupabaseClientWithAccessToken } from "../../db/supabase";
import {
  createInvitedEmployeeFixture,
  createOwnerTenantFixture,
  createTenantMemberFixture,
  fail,
  pass,
  makeUniqueEmail,
} from "./test-helpers";

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

  const owner = await createOwnerTenantFixture({
    companyName: `Tenant API ${Date.now()}`,
    firstName: "Owner",
    lastName: "Api",
    emailPrefix: "owner-api",
  });
  const linkedEmployee = await createInvitedEmployeeFixture({
    owner,
    firstName: "Api",
    lastName: "Linked",
    emailPrefix: "api-shifts-linked",
  });
  const sameTenantUnlinked = await createTenantMemberFixture({
    companyId: owner.companyId,
    role: "employee",
    emailPrefix: "api-shifts-unlinked",
  });

  const ownerClient = createSupabaseClientWithAccessToken(owner.accessToken);
  const now = new Date();
  const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const inEightDays = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

  const { error: seedError } = await ownerClient.from("shifts").insert([
    {
      company_id: owner.companyId,
      user_id: linkedEmployee.profileId,
      starts_at: inOneDay.toISOString(),
      ends_at: new Date(inOneDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_by: owner.authUserId,
    },
    {
      company_id: owner.companyId,
      user_id: linkedEmployee.profileId,
      starts_at: inEightDays.toISOString(),
      ends_at: new Date(inEightDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_by: owner.authUserId,
    },
  ]);
  if (seedError) {
    fail(`Failed to seed API my-shifts fixture: ${seedError.message}`);
  }

  const authorized = await requestMyShifts(baseUrl, linkedEmployee.accessToken);
  if (authorized.response.status !== 200 || !authorized.body.ok || !authorized.body.data) {
    fail(
      `Expected 200 from /api/my/shifts. status=${authorized.response.status}, body=${JSON.stringify(authorized.body)}`,
    );
  }
  if (authorized.body.data.length !== 1) {
    fail(`Expected 1 upcoming shift for linked employee, got ${authorized.body.data.length}`);
  }
  if (authorized.body.data[0].company_id !== owner.companyId) {
    fail("/api/my/shifts returned cross-tenant data.");
  }
  pass("/api/my/shifts returns only linked employee upcoming shifts.");

  const unauthorized = await requestMyShifts(baseUrl);
  if (unauthorized.response.status !== 401) {
    fail(`Expected 401 for missing token, got ${unauthorized.response.status}`);
  }
  pass("/api/my/shifts enforces bearer token auth.");

  const noTenantEmail = makeUniqueEmail("api-no-tenant");
  const noTenantPassword = "ApiNoTenant123!";
  const authClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signUpError } = await authClient.auth.signUp({
    email: noTenantEmail,
    password: noTenantPassword,
  });
  if (signUpError) {
    fail(`Failed to sign up no-tenant API user: ${signUpError.message}`);
  }
  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email: noTenantEmail,
    password: noTenantPassword,
  });
  if (signInError || !signInData.session?.access_token) {
    fail(`Failed to sign in no-tenant API user: ${signInError?.message ?? "unknown"}`);
  }

  const noTenantResponse = await requestMyShifts(baseUrl, signInData.session.access_token);
  if (noTenantResponse.response.status !== 403 || noTenantResponse.body.ok !== false) {
    fail(
      `Expected 403 for no-tenant user, got status=${noTenantResponse.response.status}, body=${JSON.stringify(noTenantResponse.body)}`,
    );
  }
  pass("/api/my/shifts rejects users without tenant linkage.");

  const missingEmployee = await requestMyShifts(baseUrl, sameTenantUnlinked.accessToken);
  if (missingEmployee.response.status !== 403 || missingEmployee.body.ok !== false) {
    fail(
      `Expected 403 for missing employee link, got status=${missingEmployee.response.status}, body=${JSON.stringify(missingEmployee.body)}`,
    );
  }
  const missingEmployeeMessage =
    typeof missingEmployee.body.error === "string"
      ? missingEmployee.body.error
      : missingEmployee.body.error?.message ?? "";
  if (!missingEmployeeMessage.toLowerCase().includes("employee")) {
    fail(`Missing-employee rejection message is unclear: ${missingEmployeeMessage}`);
  }
  pass("/api/my/shifts rejects tenant users without employee linkage.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
