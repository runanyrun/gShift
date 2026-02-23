import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env";

interface EdgeCaseCredentials {
  email: string;
  password: string;
}

async function signIn(email: string, password: string) {
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session?.access_token) {
    throw new Error(`Sign in failed for ${email}: ${error?.message ?? "unknown"}`);
  }

  return {
    authUserId: data.user.id,
    accessToken: data.session.access_token,
  };
}

async function runDuplicateOnboardingCheck(credentials: EdgeCaseCredentials) {
  const session = await signIn(credentials.email, credentials.password);

  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { error } = await client.rpc("complete_owner_onboarding", {
    p_auth_user_id: session.authUserId,
    p_email: credentials.email,
    p_first_name: "Duplicate",
    p_last_name: "Test",
    p_company_name: "Duplicate Co",
    p_sector: null,
    p_country_code: null,
    p_currency_code: null,
    p_timezone: null,
    p_plan_type: null,
    p_subscription_status: null,
  });

  if (!error || !error.message.includes("Onboarding already completed")) {
    throw new Error(
      `Duplicate onboarding check failed. Expected onboarding exception, got: ${error?.message ?? "no error"}`,
    );
  }
}

async function main() {
  const email = process.env.EDGE_CASE_EMAIL;
  const password = process.env.EDGE_CASE_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing EDGE_CASE_EMAIL or EDGE_CASE_PASSWORD.");
  }

  await runDuplicateOnboardingCheck({ email, password });
  console.log("onboarding-edge-case: duplicate onboarding is correctly blocked.");
  console.log(
    "For NULL auth.uid() and multi-company anomaly, run supabase/tests/0002_onboarding_edge_cases.sql in SQL Editor.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
