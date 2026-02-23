/**
 * Local test setup:
 * 1. Copy `.env.test.local.example` -> `.env.test.local`
 * 2. Fill dummy accounts for TENANT_A/B and EDGE_CASE
 * 3. Run all tests: npm run test:workflow
 * 4. Check console output for pass/fail
 */
import { createSupabaseClientWithAccessToken } from "../../db/supabase";
import { ShiftService } from "../../../features/shift/services/shift.service";
import { fail, pass, requireEnv, signIn } from "./test-helpers";

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

  const rawClient = tenantAClient as any;
  const { error: immutableCompanyUpdateError } = await rawClient
    .from("shifts")
    .update({ company_id: tenantB.companyId })
    .eq("id", createdShift.id);
  if (!immutableCompanyUpdateError) {
    fail("company_id was unexpectedly mutable on shifts.");
  }
  pass("company_id is immutable through tenant-safe RLS/update rules.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
