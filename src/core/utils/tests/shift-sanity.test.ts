import { createClient } from "@supabase/supabase-js";
import { createSupabaseClientWithAccessToken } from "../../db/supabase";
import { ShiftService } from "../../../features/shift/services/shift.service";
import { env } from "../../config/env";

interface Credentials {
  email: string;
  password: string;
}

interface TenantContext {
  accessToken: string;
  authUserId: string;
  companyId: string;
  profileId: string;
}

function pass(message: string) {
  console.log(`PASS: ${message}`);
}

function fail(message: string): never {
  throw new Error(`FAIL: ${message}`);
}

async function signIn(credentials: Credentials): Promise<TenantContext> {
  const authClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

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

async function main() {
  const tenantAEmail = process.env.TENANT_A_EMAIL;
  const tenantAPassword = process.env.TENANT_A_PASSWORD;
  const tenantBEmail = process.env.TENANT_B_EMAIL;
  const tenantBPassword = process.env.TENANT_B_PASSWORD;

  if (!tenantAEmail || !tenantAPassword || !tenantBEmail || !tenantBPassword) {
    fail(
      "Missing TENANT_A_EMAIL/TENANT_A_PASSWORD/TENANT_B_EMAIL/TENANT_B_PASSWORD environment variables.",
    );
  }

  const [tenantA, tenantB] = await Promise.all([
    signIn({ email: tenantAEmail, password: tenantAPassword }),
    signIn({ email: tenantBEmail, password: tenantBPassword }),
  ]);

  const tenantAClient = createSupabaseClientWithAccessToken(tenantA.accessToken);
  const shiftService = new ShiftService(tenantAClient);

  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const createdShift = await shiftService.createShift({
    starts_at: startsAt,
    ends_at: endsAt,
    user_id: tenantA.profileId,
  });
  if (createdShift.company_id !== tenantA.companyId) {
    fail("createShift() created a shift outside the current tenant company.");
  }
  pass("createShift() works for current tenant.");

  const tenantAShifts = await shiftService.listShifts();
  if (tenantAShifts.some((shift) => shift.company_id !== tenantA.companyId)) {
    fail("listShifts() returned data outside current tenant scope.");
  }
  pass("listShifts() returns only current tenant data.");

  const { error: crossTenantInsertError } = await tenantAClient.from("shifts").insert({
    company_id: tenantB.companyId,
    user_id: tenantA.profileId,
    starts_at: startsAt,
    ends_at: endsAt,
    created_by: tenantA.authUserId,
  });
  if (!crossTenantInsertError) {
    fail("Cross-tenant insert was unexpectedly allowed.");
  }
  pass("Cross-tenant insert is blocked by RLS.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
