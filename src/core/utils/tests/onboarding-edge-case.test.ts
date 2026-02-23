import { createClient } from "@supabase/supabase-js";
import { createSupabaseClientWithAccessToken } from "../../db/supabase";
import { env } from "../../config/env";

function pass(message: string) {
  console.log(`PASS: ${message}`);
}

function fail(message: string): never {
  throw new Error(`FAIL: ${message}`);
}

async function signInForDuplicateTest() {
  const email = process.env.EDGE_CASE_EMAIL;
  const password = process.env.EDGE_CASE_PASSWORD;
  if (!email || !password) {
    fail("Missing EDGE_CASE_EMAIL or EDGE_CASE_PASSWORD for duplicate onboarding test.");
  }

  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session?.access_token) {
    fail(`Sign in failed for duplicate onboarding test: ${error?.message ?? "unknown"}`);
  }

  return { authUserId: data.user.id, email, accessToken: data.session.access_token };
}

async function testDuplicateOnboarding() {
  const session = await signInForDuplicateTest();
  const client = createSupabaseClientWithAccessToken(session.accessToken);

  const { error } = await client.rpc("complete_owner_onboarding", {
    p_auth_user_id: session.authUserId,
    p_email: session.email,
    p_first_name: "Duplicate",
    p_last_name: "Case",
    p_company_name: "Duplicate Company",
    p_sector: null,
    p_country_code: null,
    p_currency_code: null,
    p_timezone: null,
    p_plan_type: null,
    p_subscription_status: null,
  });

  if (!error || !error.message.includes("Onboarding already completed")) {
    fail(
      `Expected duplicate onboarding failure, got: ${error?.message ?? "no error returned"}`,
    );
  }
  pass("Duplicate onboarding is blocked.");
}

async function testNullAuthUid() {
  const publicClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await publicClient.rpc("complete_owner_onboarding", {
    p_auth_user_id: "00000000-0000-0000-0000-000000000000",
    p_email: "null-auth@test.com",
    p_first_name: null,
    p_last_name: null,
    p_company_name: "Null Auth Company",
    p_sector: null,
    p_country_code: null,
    p_currency_code: null,
    p_timezone: null,
    p_plan_type: null,
    p_subscription_status: null,
  });

  if (!error || !error.message.toLowerCase().includes("unauthenticated")) {
    fail(`Expected unauthenticated failure, got: ${error?.message ?? "no error returned"}`);
  }
  pass("NULL auth.uid() path is blocked.");
}

async function testMultipleCompaniesForSameUser() {
  const token = process.env.MULTI_COMPANY_ACCESS_TOKEN;

  if (!token) {
    console.log(
      "SKIP: MULTI_COMPANY_ACCESS_TOKEN not provided. Provide token for an intentionally anomalous user to runtime-verify multi-company exception.",
    );
    return;
  }

  const client = createSupabaseClientWithAccessToken(token);
  const { error } = await client.rpc("current_user_company_id");
  if (!error || !error.message.includes("Multiple companies found")) {
    fail(
      `Expected multiple-company exception, got: ${error?.message ?? "no error returned"}`,
    );
  }
  pass("Multiple companies for same user throws exception.");
}

async function main() {
  await testDuplicateOnboarding();
  await testNullAuthUid();
  await testMultipleCompaniesForSameUser();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
