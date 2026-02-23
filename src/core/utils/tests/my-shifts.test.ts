/**
 * Local test setup:
 * 1. Copy `.env.test.local.example` -> `.env.test.local`
 * 2. Fill TENANT_A/B credentials
 * 3. Run: npm run test:my-shifts:service
 */
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getMyUpcomingShifts } from "../../shifts/my-shifts";
import { createSupabaseClientWithAccessToken } from "../../db/supabase";
import { env } from "../../config/env";
import { fail, pass, requireEnv, signIn, skip } from "./test-helpers";

interface LinkedEmployeeContext {
  authUserId: string;
  accessToken: string;
  profileId: string;
  employeeId: string;
  companyId: string;
}

async function createLinkedEmployeeViaInvite(params: {
  managementClient: ReturnType<typeof createSupabaseClientWithAccessToken>;
  managementAuthUserId: string;
  companyId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<LinkedEmployeeContext> {
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
    fail(`Failed to create invite employee: ${employeeError?.message ?? "unknown"}`);
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
    fail(`Failed to create invite row: ${inviteError.message}`);
  }

  const authClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signUpError } = await authClient.auth.signUp({
    email,
    password,
  });
  if (signUpError) {
    fail(`Failed to sign up invite user (${email}): ${signUpError.message}`);
  }

  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.user || !signInData.session?.access_token) {
    fail(`Failed to sign in invite user (${email}): ${signInError?.message ?? "unknown"}`);
  }

  const scoped = createSupabaseClientWithAccessToken(signInData.session.access_token);
  const { error: acceptError } = await scoped.rpc("accept_employee_invite", {
    p_raw_token: rawToken,
  });
  if (acceptError) {
    fail(`Failed to accept invite for ${email}: ${acceptError.message}`);
  }

  const { data: profile, error: profileError } = await scoped
    .from("users")
    .select("id, company_id")
    .eq("auth_user_id", signInData.user.id)
    .single();
  if (profileError || !profile) {
    fail(`Failed to load linked profile for ${email}: ${profileError?.message ?? "unknown"}`);
  }

  return {
    authUserId: signInData.user.id,
    accessToken: signInData.session.access_token,
    profileId: profile.id,
    employeeId: employee.id,
    companyId: profile.company_id,
  };
}

async function main() {
  const tenantAEmail = requireEnv("TENANT_A_EMAIL");
  const tenantAPassword = requireEnv("TENANT_A_PASSWORD");
  const tenantBEmail = requireEnv("TENANT_B_EMAIL");
  const tenantBPassword = requireEnv("TENANT_B_PASSWORD");

  const [tenantA, tenantB] = await Promise.all([
    signIn({ email: tenantAEmail, password: tenantAPassword }),
    signIn({ email: tenantBEmail, password: tenantBPassword }),
  ]);

  const tenantAClient = createSupabaseClientWithAccessToken(tenantA.accessToken);
  const tenantBClient = createSupabaseClientWithAccessToken(tenantB.accessToken);

  const { data: managementAllowed, error: managementError } = await tenantAClient.rpc(
    "is_management_user",
  );
  if (managementError) {
    fail(`is_management_user preflight failed: ${managementError.message}`);
  }
  if (!managementAllowed) {
    const now = new Date();
    const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const inEightDays = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

    const { data: tenantASeedRows, error: tenantASeedError } = await tenantAClient
      .from("shifts")
      .insert([
      {
        company_id: tenantA.companyId,
        user_id: tenantA.profileId,
        starts_at: inTwoDays.toISOString(),
        ends_at: new Date(inTwoDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        created_by: tenantA.authUserId,
      },
      {
        company_id: tenantA.companyId,
        user_id: tenantA.profileId,
        starts_at: inOneDay.toISOString(),
        ends_at: new Date(inOneDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        created_by: tenantA.authUserId,
      },
      {
        company_id: tenantA.companyId,
        user_id: tenantA.profileId,
        starts_at: inEightDays.toISOString(),
        ends_at: new Date(inEightDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        created_by: tenantA.authUserId,
      },
      ])
      .select("id, starts_at");
    if (tenantASeedError || !tenantASeedRows || tenantASeedRows.length !== 3) {
      fail(`Failed to seed tenant A fallback shifts: ${tenantASeedError?.message ?? "unknown"}`);
    }
    const inWindowSeedIds = new Set([tenantASeedRows[0].id, tenantASeedRows[1].id]);
    const outsideWindowSeedId = tenantASeedRows[2].id;

    const { error: tenantBSeedError } = await tenantBClient.from("shifts").insert({
      company_id: tenantB.companyId,
      user_id: tenantB.profileId,
      starts_at: inOneDay.toISOString(),
      ends_at: new Date(inOneDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_by: tenantB.authUserId,
    });
    if (tenantBSeedError) {
      fail(`Failed to seed tenant B fallback shift: ${tenantBSeedError.message}`);
    }

    const tenantAOnly = await getMyUpcomingShifts({
      supabase: tenantAClient,
      tenantId: tenantA.companyId,
      userId: tenantA.authUserId,
      now,
    });
    const returnedIds = new Set(tenantAOnly.map((shift) => shift.id));
    for (const requiredId of inWindowSeedIds) {
      if (!returnedIds.has(requiredId)) {
        fail("Fallback service query did not return newly inserted in-window shift.");
      }
    }
    if (returnedIds.has(outsideWindowSeedId)) {
      fail("Fallback service query included a shift outside the next-7-days window.");
    }
    if (tenantAOnly.some((shift) => shift.company_id !== tenantA.companyId)) {
      fail("Fallback service query leaked cross-tenant rows.");
    }
    pass("Fallback: getMyUpcomingShifts enforces next-7-days window + tenant isolation.");
    skip(
      "Full same-tenant multi-employee coverage requires a management test account to create invite-linked employee fixtures.",
    );
  }

  const userOne = await createLinkedEmployeeViaInvite({
    managementClient: tenantAClient,
    managementAuthUserId: tenantA.authUserId,
    companyId: tenantA.companyId,
    email: `myshift-u1-${Date.now()}@example.test`,
    password: "MyShiftUser123!",
    firstName: "Shift",
    lastName: "One",
  });

  const userTwo = await createLinkedEmployeeViaInvite({
    managementClient: tenantAClient,
    managementAuthUserId: tenantA.authUserId,
    companyId: tenantA.companyId,
    email: `myshift-u2-${Date.now()}@example.test`,
    password: "MyShiftUser123!",
    firstName: "Shift",
    lastName: "Two",
  });

  const now = new Date();
  const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const inEightDays = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

  const shiftInserts = [
    {
      company_id: tenantA.companyId,
      user_id: userOne.profileId,
      starts_at: inTwoDays.toISOString(),
      ends_at: new Date(inTwoDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_by: tenantA.authUserId,
    },
    {
      company_id: tenantA.companyId,
      user_id: userOne.profileId,
      starts_at: inOneDay.toISOString(),
      ends_at: new Date(inOneDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_by: tenantA.authUserId,
    },
    {
      company_id: tenantA.companyId,
      user_id: userTwo.profileId,
      starts_at: inThreeDays.toISOString(),
      ends_at: new Date(inThreeDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_by: tenantA.authUserId,
    },
    {
      company_id: tenantA.companyId,
      user_id: userOne.profileId,
      starts_at: inEightDays.toISOString(),
      ends_at: new Date(inEightDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_by: tenantA.authUserId,
    },
    {
      company_id: tenantB.companyId,
      user_id: tenantB.profileId,
      starts_at: inOneDay.toISOString(),
      ends_at: new Date(inOneDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      created_by: tenantB.authUserId,
    },
  ];

  const { error: insertError } = await tenantAClient.from("shifts").insert(shiftInserts.slice(0, 4));
  if (insertError) {
    fail(`Failed to seed tenant A shifts: ${insertError.message}`);
  }

  const { error: crossTenantInsertError } = await tenantBClient.from("shifts").insert(shiftInserts[4]);
  if (crossTenantInsertError) {
    fail(`Failed to seed tenant B shift: ${crossTenantInsertError.message}`);
  }

  const userOneClient = createSupabaseClientWithAccessToken(userOne.accessToken);
  const userTwoClient = createSupabaseClientWithAccessToken(userTwo.accessToken);

  const userOneShifts = await getMyUpcomingShifts({
    supabase: userOneClient,
    tenantId: tenantA.companyId,
    userId: userOne.authUserId,
    now,
  });

  if (userOneShifts.length !== 2) {
    fail(`Expected 2 shifts for employee1 in next 7 days, got ${userOneShifts.length}`);
  }
  if (userOneShifts[0].starts_at > userOneShifts[1].starts_at) {
    fail("Employee1 shifts are not sorted ascending by starts_at.");
  }
  if (userOneShifts.some((shift) => shift.company_id !== tenantA.companyId)) {
    fail("Employee1 shifts include cross-tenant rows.");
  }
  if (userOneShifts.some((shift) => shift.user_id !== userOne.profileId)) {
    fail("Employee1 shifts include other employee rows.");
  }
  pass("Employee1 receives only own shifts in next 7 days, sorted ascending.");

  const userTwoShifts = await getMyUpcomingShifts({
    supabase: userTwoClient,
    tenantId: tenantA.companyId,
    userId: userTwo.authUserId,
    now,
  });
  if (userTwoShifts.length !== 1) {
    fail(`Expected 1 shift for employee2 in next 7 days, got ${userTwoShifts.length}`);
  }
  if (userTwoShifts[0].user_id !== userTwo.profileId) {
    fail("Employee2 shifts include incorrect user profile.");
  }
  pass("Employee2 receives only own shift in next 7 days.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
