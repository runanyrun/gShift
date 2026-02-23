/**
 * Local test setup:
 * 1. Copy `.env.test.local.example` -> `.env.test.local`
 * 2. Fill TENANT_A/B credentials
 * 3. Run test: npm run test:employees
 */
import { createClient } from "@supabase/supabase-js";
import { createSupabaseClientWithAccessToken } from "../../db/supabase";
import { env } from "../../config/env";
import { fail, isMissingRelationError, pass, requireEnv, signIn, skip } from "./test-helpers";
import { createHash, randomBytes } from "crypto";

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

  const { data: managementAllowed, error: managementCheckError } = await tenantAClient.rpc(
    "is_management_user",
  );
  if (managementCheckError) {
    if (managementCheckError.code === "PGRST202") {
      fail(
        "Required RPC public.is_management_user() is missing. Re-run migration 0005_employees_foundation.sql (or run `supabase db push`).",
      );
    }
    fail(`Management preflight check failed: ${managementCheckError.message}`);
  }
  if (!managementAllowed) {
    fail(
      "TENANT_A test account is not management/administration in its tenant. Use an owner/admin/manager account for TENANT_A_* env values.",
    );
  }

  const employeeEmail = `employee-${Date.now()}@tenant-a.test`;
  const { data: createdEmployee, error: createEmployeeError } = await tenantAClient
    .from("employees")
    .insert({
      tenant_id: tenantA.companyId,
      first_name: "Tenant",
      last_name: "Employee",
      email: employeeEmail,
      is_active: true,
      notes: "management-only-note",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (createEmployeeError || !createdEmployee) {
    if (isMissingRelationError(createEmployeeError?.message)) {
      skip(
        "employees table is missing. Apply migrations with `npm run db:push` or run 0005_employees_foundation.sql in Supabase SQL Editor.",
      );
    }
    fail(`Failed to create employee for sanity test: ${createEmployeeError?.message ?? "unknown"}`);
  }

  const { data: crossTenantRead } = await tenantBClient
    .from("employees")
    .select("id")
    .eq("id", createdEmployee.id)
    .maybeSingle();
  if (crossTenantRead) {
    fail("Tenant B could read tenant A employee row.");
  }
  pass("Cross-tenant employee read is blocked.");

  const { data: managementRead, error: managementReadError } = await tenantAClient
    .from("employees")
    .select("id, notes")
    .eq("id", createdEmployee.id)
    .single();
  if (managementReadError || !managementRead || managementRead.notes !== "management-only-note") {
    fail(`Management could not read notes: ${managementReadError?.message ?? "missing notes"}`);
  }
  pass("Management can read employee notes.");

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { data: inviteRow, error: inviteError } = await tenantAClient
    .from("employee_invites")
    .insert({
      tenant_id: tenantA.companyId,
      employee_id: createdEmployee.id,
      email: employeeEmail,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      status: "pending",
      created_by: tenantA.authUserId,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (inviteError || !inviteRow || inviteRow.status !== "pending") {
    if (isMissingRelationError(inviteError?.message)) {
      skip(
        "employee_invites table is missing. Apply migrations with `npm run db:push` or run 0005_employees_foundation.sql in Supabase SQL Editor.",
      );
    }
    fail(`Invite row was not created as pending: ${inviteError?.message ?? "unknown"}`);
  }
  pass("Invite row is created with pending status and token hash.");

  const regularEmail = `regular-${Date.now()}@employee.test`;
  const regularPassword = "EmployeePass123!";
  const regularClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signUpData, error: signUpError } = await regularClient.auth.signUp({
    email: regularEmail,
    password: regularPassword,
  });
  if (signUpError) {
    fail(`Failed to create regular auth user: ${signUpError.message}`);
  }
  const regularSignIn = await regularClient.auth.signInWithPassword({
    email: regularEmail,
    password: regularPassword,
  });
  if (regularSignIn.error || !regularSignIn.data.session?.access_token) {
    fail(`Failed to sign in regular auth user: ${regularSignIn.error?.message ?? "unknown"}`);
  }
  const regularScopedClient = createSupabaseClientWithAccessToken(
    regularSignIn.data.session.access_token,
  );

  const { data: accepted, error: acceptError } = await regularScopedClient.rpc(
    "accept_employee_invite",
    {
      p_raw_token: rawToken,
    },
  );
  if (acceptError || !Array.isArray(accepted) || accepted.length === 0) {
    if (acceptError?.message?.toLowerCase().includes("accept_employee_invite")) {
      skip(
        "accept_employee_invite RPC is missing. Apply migrations with `npm run db:push` or run 0005_employees_foundation.sql in Supabase SQL Editor.",
      );
    }
    fail(`Invite acceptance failed: ${acceptError?.message ?? "unknown"}`);
  }

  const { data: linkedEmployee, error: linkedError } = await tenantAClient
    .from("employees")
    .select("user_id")
    .eq("id", createdEmployee.id)
    .single();
  if (linkedError || !linkedEmployee?.user_id || linkedEmployee.user_id !== regularSignIn.data.user?.id) {
    fail(`Employee user linking failed: ${linkedError?.message ?? "no linked user id"}`);
  }
  pass("Invite acceptance links employee to auth user.");

  const { data: myEmployee, error: myEmployeeError } = await regularScopedClient.rpc(
    "get_my_employee",
  );
  const ownRow = Array.isArray(myEmployee) ? myEmployee[0] : null;
  if (myEmployeeError || !ownRow) {
    fail(`Regular user could not fetch own employee: ${myEmployeeError?.message ?? "no row"}`);
  }
  if (ownRow.notes !== null) {
    fail("Regular user could read management-only notes.");
  }
  pass("Regular user can read own employee record with notes masked.");

  const expiredRawToken = randomBytes(32).toString("hex");
  const expiredHash = createHash("sha256").update(expiredRawToken).digest("hex");
  const { error: expiredInsertError } = await tenantAClient.from("employee_invites").insert({
    tenant_id: tenantA.companyId,
    employee_id: createdEmployee.id,
    email: employeeEmail,
    token_hash: expiredHash,
    expires_at: new Date(Date.now() - 1000 * 60).toISOString(),
    status: "pending",
    created_by: tenantA.authUserId,
    created_at: new Date().toISOString(),
  });
  if (expiredInsertError) {
    fail(`Could not create expired invite: ${expiredInsertError.message}`);
  }

  const { error: expiredAcceptError } = await regularScopedClient.rpc("accept_employee_invite", {
    p_raw_token: expiredRawToken,
  });
  if (!expiredAcceptError || !expiredAcceptError.message.toLowerCase().includes("expired")) {
    fail(
      `Expected expired token failure, got: ${expiredAcceptError?.message ?? "no error returned"}`,
    );
  }
  pass("Expired invite token is rejected.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
