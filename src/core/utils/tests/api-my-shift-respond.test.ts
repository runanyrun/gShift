/**
 * Deterministic core API test for shift response flow:
 * 1. Run: npm run test:api-my-shift-respond
 */
import { createSupabaseClientWithAccessToken } from "../../db/supabase";
import {
  createInvitedEmployeeFixture,
  createOwnerTenantFixture,
  fail,
  pass,
} from "./test-helpers";

interface ApiRespondBody {
  ok: boolean;
  data?: {
    id: string;
    acceptance_status: "pending" | "accepted" | "declined";
    responded_at: string;
  };
  error?: { message?: string; code?: string } | string;
}

async function respondToShift(baseUrl: string, shiftId: string, accessToken: string, status: "accepted" | "declined") {
  const response = await fetch(`${baseUrl}/api/my/shifts/${shiftId}/respond`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  const body = (await response.json()) as ApiRespondBody;
  return { response, body };
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

  const ownerA = await createOwnerTenantFixture({
    companyName: `Tenant Respond A ${Date.now()}`,
    firstName: "Owner",
    lastName: "A",
    emailPrefix: "respond-owner-a",
  });
  const ownerB = await createOwnerTenantFixture({
    companyName: `Tenant Respond B ${Date.now()}`,
    firstName: "Owner",
    lastName: "B",
    emailPrefix: "respond-owner-b",
  });

  const assignedEmployee = await createInvitedEmployeeFixture({
    owner: ownerA,
    firstName: "Assigned",
    lastName: "Employee",
    emailPrefix: "respond-assigned",
  });
  const sameTenantOtherEmployee = await createInvitedEmployeeFixture({
    owner: ownerA,
    firstName: "Same",
    lastName: "Tenant",
    emailPrefix: "respond-same-tenant",
  });
  const otherTenantEmployee = await createInvitedEmployeeFixture({
    owner: ownerB,
    firstName: "Other",
    lastName: "Tenant",
    emailPrefix: "respond-other-tenant",
  });

  const ownerAClient = createSupabaseClientWithAccessToken(ownerA.accessToken);
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

  const { data: seededShift, error: seedError } = await ownerAClient
    .from("shifts")
    .insert({
      company_id: ownerA.companyId,
      user_id: assignedEmployee.profileId,
      starts_at: startsAt,
      ends_at: endsAt,
      created_by: ownerA.authUserId,
    })
    .select("id, starts_at, acceptance_status")
    .single();

  if (seedError || !seededShift) {
    fail(`Failed to seed shift respond fixture: ${seedError?.message ?? "unknown"}`);
  }
  if (seededShift.acceptance_status !== "pending") {
    fail(`Expected seeded shift to be pending, got ${seededShift.acceptance_status}`);
  }

  const sameTenantForbidden = await respondToShift(
    baseUrl,
    seededShift.id,
    sameTenantOtherEmployee.accessToken,
    "declined",
  );
  if (sameTenantForbidden.response.status !== 403 || sameTenantForbidden.body.ok !== false) {
    fail(
      `Expected 403 for same-tenant non-owner response, got status=${sameTenantForbidden.response.status}, body=${JSON.stringify(sameTenantForbidden.body)}`,
    );
  }
  pass("/api/my/shifts/[id]/respond blocks responding to another employee shift in same tenant.");

  const crossTenantForbidden = await respondToShift(
    baseUrl,
    seededShift.id,
    otherTenantEmployee.accessToken,
    "declined",
  );
  if (crossTenantForbidden.response.status !== 403 || crossTenantForbidden.body.ok !== false) {
    fail(
      `Expected 403 for cross-tenant response, got status=${crossTenantForbidden.response.status}, body=${JSON.stringify(crossTenantForbidden.body)}`,
    );
  }
  pass("/api/my/shifts/[id]/respond blocks cross-tenant responses.");

  const accepted = await respondToShift(baseUrl, seededShift.id, assignedEmployee.accessToken, "accepted");
  if (accepted.response.status !== 200 || !accepted.body.ok || !accepted.body.data) {
    fail(
      `Expected 200 for own response, got status=${accepted.response.status}, body=${JSON.stringify(accepted.body)}`,
    );
  }
  if (accepted.body.data.acceptance_status !== "accepted") {
    fail(`Expected acceptance_status=accepted, got ${accepted.body.data.acceptance_status}`);
  }
  pass("/api/my/shifts/[id]/respond allows employee to accept own shift.");

  const { data: after, error: afterError } = await ownerAClient
    .from("shifts")
    .select("id, starts_at, acceptance_status")
    .eq("id", seededShift.id)
    .single();
  if (afterError || !after) {
    fail(`Failed to verify accepted shift: ${afterError?.message ?? "unknown"}`);
  }

  if (after.starts_at !== startsAt) {
    fail("Shift starts_at changed during acceptance response.");
  }
  if (after.acceptance_status !== "accepted") {
    fail(`Expected persisted acceptance_status=accepted, got ${after.acceptance_status}`);
  }
  pass("Shift response updates acceptance fields without changing starts_at.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
