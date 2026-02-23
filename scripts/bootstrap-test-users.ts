import { createClient } from "@supabase/supabase-js";
import { env } from "../src/core/config/env";
import { createSupabaseClientWithAccessToken } from "../src/core/db/supabase";

type TargetUser = {
  email: string;
  password: string;
  companyName: string;
  firstName: string;
  lastName: string;
};

const USERS: TargetUser[] = [
  {
    email: "edge@example.com",
    password: "EdgeTest123!",
    companyName: "Edge Dummy Company",
    firstName: "Edge",
    lastName: "Case",
  },
  {
    email: "tenantA@example.com",
    password: "TenantA123!",
    companyName: "Tenant A",
    firstName: "Tenant",
    lastName: "A",
  },
  {
    email: "tenantB@example.com",
    password: "TenantB123!",
    companyName: "Tenant B",
    firstName: "Tenant",
    lastName: "B",
  },
];

function log(message: string) {
  console.log(message);
}

async function signIn(email: string, password: string) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.auth.signInWithPassword({ email, password });
}

async function signUp(email: string, password: string) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.auth.signUp({ email, password });
}

async function ensureOnboarding(
  accessToken: string,
  authUserId: string,
  email: string,
  companyName: string,
  firstName: string,
  lastName: string,
) {
  const client = createSupabaseClientWithAccessToken(accessToken);
  const { data, error } = await client.rpc("complete_owner_onboarding", {
    p_auth_user_id: authUserId,
    p_email: email,
    p_first_name: firstName,
    p_last_name: lastName,
    p_company_name: companyName,
    p_sector: null,
    p_country_code: null,
    p_currency_code: null,
    p_timezone: null,
    p_plan_type: null,
    p_subscription_status: null,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already completed")) {
      return null;
    }
    throw new Error(`Onboarding failed for ${email}: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.company_id) {
    throw new Error(`Onboarding result missing company_id for ${email}`);
  }

  return row.company_id as string;
}

async function getProfileCompany(accessToken: string, authUserId: string): Promise<string> {
  const client = createSupabaseClientWithAccessToken(accessToken);
  const { data, error } = await client
    .from("users")
    .select("company_id")
    .eq("auth_user_id", authUserId)
    .single();

  if (error || !data?.company_id) {
    throw new Error(`Profile lookup failed for ${authUserId}: ${error?.message ?? "no data"}`);
  }
  return data.company_id;
}

async function ensureUser(target: TargetUser) {
  const signInResult = await signIn(target.email, target.password);
  let authUserId = signInResult.data.user?.id;
  let accessToken = signInResult.data.session?.access_token;

  if (signInResult.error || !authUserId || !accessToken) {
    const signUpResult = await signUp(target.email, target.password);
    if (signUpResult.error) {
      throw new Error(
        `Could not sign in/sign up ${target.email}: ${signUpResult.error.message}`,
      );
    }

    authUserId = signUpResult.data.user?.id ?? "";
    accessToken = signUpResult.data.session?.access_token ?? "";

    if (!authUserId) {
      throw new Error(`Auth user could not be created for ${target.email}.`);
    }
    if (!accessToken) {
      throw new Error(
        `No access token for ${target.email}. Email confirmation may be required before onboarding.`,
      );
    }
  }

  await ensureOnboarding(
    accessToken,
    authUserId,
    target.email,
    target.companyName,
    target.firstName,
    target.lastName,
  );

  const companyId = await getProfileCompany(accessToken, authUserId);
  log(`${target.email} => auth_user_id=${authUserId} company_id=${companyId}`);
}

async function main() {
  for (const user of USERS) {
    await ensureUser(user);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
