/**
 * Deterministic core test (no external seed dependency):
 * 1. Run: npm run test:my-shifts:service
 */
import { getMyUpcomingShifts } from "../../shifts/my-shifts";
import { createSupabaseClientWithAccessToken } from "../../db/supabase";
import {
  createOwnerTenantFixture,
  createTenantMemberFixture,
  fail,
  pass,
} from "./test-helpers";

async function main() {
  const ownerA = await createOwnerTenantFixture({
    companyName: `Tenant A ${Date.now()}`,
    firstName: "Owner",
    lastName: "A",
    emailPrefix: "owner-a",
  });
  const ownerB = await createOwnerTenantFixture({
    companyName: `Tenant B ${Date.now()}`,
    firstName: "Owner",
    lastName: "B",
    emailPrefix: "owner-b",
  });

  const user1 = await createTenantMemberFixture({
    companyId: ownerA.companyId,
    role: "owner",
    emailPrefix: "myshifts-u1",
  });
  const user2 = await createTenantMemberFixture({
    companyId: ownerA.companyId,
    role: "owner",
    emailPrefix: "myshifts-u2",
  });
  const user3 = await createTenantMemberFixture({
    companyId: ownerB.companyId,
    role: "owner",
    emailPrefix: "myshifts-u3",
  });

  const ownerAClient = createSupabaseClientWithAccessToken(ownerA.accessToken);
  const ownerBClient = createSupabaseClientWithAccessToken(ownerB.accessToken);

  const now = new Date();
  const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const inEightDays = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

  const { data: tenantASeedRows, error: tenantASeedError } = await ownerAClient
    .from("shifts")
    .insert([
      {
        company_id: ownerA.companyId,
        user_id: user1.profileId,
        starts_at: inTwoDays.toISOString(),
        ends_at: new Date(inTwoDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        created_by: ownerA.authUserId,
      },
      {
        company_id: ownerA.companyId,
        user_id: user1.profileId,
        starts_at: inOneDay.toISOString(),
        ends_at: new Date(inOneDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        created_by: ownerA.authUserId,
      },
      {
        company_id: ownerA.companyId,
        user_id: user2.profileId,
        starts_at: inThreeDays.toISOString(),
        ends_at: new Date(inThreeDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        created_by: ownerA.authUserId,
      },
      {
        company_id: ownerA.companyId,
        user_id: user1.profileId,
        starts_at: inEightDays.toISOString(),
        ends_at: new Date(inEightDays.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        created_by: ownerA.authUserId,
      },
    ])
    .select("id, user_id, starts_at");
  if (tenantASeedError || !tenantASeedRows || tenantASeedRows.length !== 4) {
    fail(`Failed to seed tenant A shifts: ${tenantASeedError?.message ?? "unknown"}`);
  }

  const { data: tenantBSeedRows, error: tenantBSeedError } = await ownerBClient
    .from("shifts")
    .insert([
      {
        company_id: ownerB.companyId,
        user_id: user3.profileId,
        starts_at: inOneDay.toISOString(),
        ends_at: new Date(inOneDay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        created_by: ownerB.authUserId,
      },
    ])
    .select("id");
  if (tenantBSeedError || !tenantBSeedRows || tenantBSeedRows.length !== 1) {
    fail(`Failed to seed tenant B shifts: ${tenantBSeedError?.message ?? "unknown"}`);
  }

  const fromMs = now.getTime();
  const toMs = inEightDays.getTime();

  const user1Client = createSupabaseClientWithAccessToken(user1.accessToken);
  const user2Client = createSupabaseClientWithAccessToken(user2.accessToken);

  const user1Shifts = await getMyUpcomingShifts({
    supabase: user1Client,
    tenantId: ownerA.companyId,
    userId: user1.authUserId,
    now,
  });
  if (user1Shifts.length !== 2) {
    fail(`Expected 2 shifts for user1 in next 7 days, got ${user1Shifts.length}`);
  }
  if (
    user1Shifts.some((shift) => shift.user_id !== user1.profileId) ||
    user1Shifts.some((shift) => shift.company_id !== ownerA.companyId)
  ) {
    fail("User1 received shifts from another user or tenant.");
  }
  if (
    user1Shifts.some((shift) => {
      const startsAtMs = new Date(shift.starts_at).getTime();
      return startsAtMs < fromMs || startsAtMs >= toMs;
    })
  ) {
    fail("User1 received a shift outside the next-7-days window.");
  }
  if (user1Shifts[0].starts_at > user1Shifts[1].starts_at) {
    fail("User1 shifts are not sorted by starts_at ascending.");
  }
  pass("User1 gets only own in-window shifts, sorted and tenant-safe.");

  const user2Shifts = await getMyUpcomingShifts({
    supabase: user2Client,
    tenantId: ownerA.companyId,
    userId: user2.authUserId,
    now,
  });
  if (user2Shifts.length !== 1) {
    fail(`Expected 1 shift for user2 in next 7 days, got ${user2Shifts.length}`);
  }
  if (user2Shifts[0].user_id !== user2.profileId || user2Shifts[0].company_id !== ownerA.companyId) {
    fail("User2 received shift data from another user or tenant.");
  }
  const user2StartMs = new Date(user2Shifts[0].starts_at).getTime();
  if (user2StartMs < fromMs || user2StartMs >= toMs) {
    fail("User2 received a shift outside the next-7-days window.");
  }
  pass("User2 gets only own in-window shift.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
