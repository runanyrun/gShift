/**
 * Local test setup:
 * 1. Copy `.env.test.local.example` -> `.env.test.local`
 * 2. Fill dummy accounts for TENANT_A/B and EDGE_CASE
 * 3. Start app: npm run dev
 * 4. Run test: npm run test:dashboard
 */
import { fail, pass, requireEnv, signIn } from "./test-helpers";

interface HttpResult {
  status: number;
  bodyText: string;
  location?: string | null;
}

interface DashboardOverviewResponse {
  userId: string;
  companyId: string;
  usersCount: number;
  shiftsCount: number;
}

interface DashboardShiftRow {
  id: string;
  companyId: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  createdBy: string;
  createdAt: string;
}

async function request(
  url: string,
  accessToken?: string,
  redirect: RequestRedirect = "follow",
): Promise<HttpResult> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { method: "GET", headers, redirect });
  return {
    status: response.status,
    bodyText: await response.text(),
    location: response.headers.get("location"),
  };
}

function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    fail(`Expected JSON response, got: ${raw}`);
  }
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const tenantAEmail = requireEnv("TENANT_A_EMAIL");
  const tenantAPassword = requireEnv("TENANT_A_PASSWORD");
  const tenantBEmail = requireEnv("TENANT_B_EMAIL");
  const tenantBPassword = requireEnv("TENANT_B_PASSWORD");

  const [tenantA, tenantB] = await Promise.all([
    signIn({ email: tenantAEmail, password: tenantAPassword }),
    signIn({ email: tenantBEmail, password: tenantBPassword }),
  ]);

  const unauthorizedOverview = await request(`${baseUrl}/api/dashboard/overview`);
  if (unauthorizedOverview.status !== 401) {
    fail(
      `Expected /api/dashboard/overview without token to return 401, got ${unauthorizedOverview.status}`,
    );
  }
  pass("Dashboard overview API returns 401 when token is missing.");

  const unauthenticatedDashboardPage = await request(
    `${baseUrl}/dashboard`,
    undefined,
    "manual",
  );
  if (
    ![307, 308].includes(unauthenticatedDashboardPage.status) ||
    !unauthenticatedDashboardPage.location?.includes("/login")
  ) {
    fail(
      `Expected /dashboard redirect to /login, got status=${unauthenticatedDashboardPage.status}, location=${unauthenticatedDashboardPage.location}`,
    );
  }
  pass("Protected dashboard page redirects unauthenticated users.");

  const unauthorizedShifts = await request(`${baseUrl}/api/dashboard/shifts`);
  if (unauthorizedShifts.status !== 401) {
    fail(
      `Expected /api/dashboard/shifts without token to return 401, got ${unauthorizedShifts.status}`,
    );
  }
  pass("Dashboard shifts API returns 401 when token is missing.");

  const tenantAOverviewResponse = await request(
    `${baseUrl}/api/dashboard/overview`,
    tenantA.accessToken,
  );
  if (tenantAOverviewResponse.status !== 200) {
    fail(
      `Tenant A overview request failed: status=${tenantAOverviewResponse.status}, body=${tenantAOverviewResponse.bodyText}`,
    );
  }
  const tenantAOverview = parseJson<DashboardOverviewResponse>(tenantAOverviewResponse.bodyText);
  if (tenantAOverview.companyId !== tenantA.companyId) {
    fail("Tenant A overview returned a different company.");
  }

  const tenantBOverviewResponse = await request(
    `${baseUrl}/api/dashboard/overview`,
    tenantB.accessToken,
  );
  if (tenantBOverviewResponse.status !== 200) {
    fail(
      `Tenant B overview request failed: status=${tenantBOverviewResponse.status}, body=${tenantBOverviewResponse.bodyText}`,
    );
  }
  const tenantBOverview = parseJson<DashboardOverviewResponse>(tenantBOverviewResponse.bodyText);
  if (tenantBOverview.companyId !== tenantB.companyId) {
    fail("Tenant B overview returned a different company.");
  }
  if (tenantAOverview.companyId === tenantBOverview.companyId) {
    fail("Dashboard overview indicates cross-tenant company leakage.");
  }
  pass("Dashboard overview is tenant-scoped.");

  const tenantAShiftsResponse = await request(
    `${baseUrl}/api/dashboard/shifts`,
    tenantA.accessToken,
  );
  if (tenantAShiftsResponse.status !== 200) {
    fail(
      `Tenant A shifts request failed: status=${tenantAShiftsResponse.status}, body=${tenantAShiftsResponse.bodyText}`,
    );
  }
  const tenantAShifts = parseJson<DashboardShiftRow[]>(tenantAShiftsResponse.bodyText);
  if (tenantAShifts.some((shift) => shift.companyId !== tenantA.companyId)) {
    fail("Tenant A shifts response contains rows from another company.");
  }
  pass("Dashboard shifts are tenant-scoped for tenant A.");

  const tenantBShiftsResponse = await request(
    `${baseUrl}/api/dashboard/shifts`,
    tenantB.accessToken,
  );
  if (tenantBShiftsResponse.status !== 200) {
    fail(
      `Tenant B shifts request failed: status=${tenantBShiftsResponse.status}, body=${tenantBShiftsResponse.bodyText}`,
    );
  }
  const tenantBShifts = parseJson<DashboardShiftRow[]>(tenantBShiftsResponse.bodyText);
  if (tenantBShifts.some((shift) => shift.companyId !== tenantB.companyId)) {
    fail("Tenant B shifts response contains rows from another company.");
  }
  pass("Dashboard shifts are tenant-scoped for tenant B.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
