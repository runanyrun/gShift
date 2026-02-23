/**
 * Local test setup:
 * 1. Copy `.env.test.local.example` -> `.env.test.local`
 * 2. Fill TENANT_A_EMAIL and TENANT_A_PASSWORD
 * 3. Start app: npm run dev
 * 4. Run: npm run test:me
 */
import { fail, pass, requireEnv, signIn } from "./test-helpers";

interface MeApiResponse {
  ok: boolean;
  data?: {
    user: { id: string; email: string | null; name: string | null };
    tenant: { id: string; name: string | null };
    permissions: string[];
    employee: { id: string; first_name: string; last_name: string; email: string } | null;
  };
  error?: { message?: string } | string;
}

async function requestMe(baseUrl: string, accessToken?: string) {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${baseUrl}/api/me`, { method: "GET", headers });
  const body = (await response.json()) as MeApiResponse;
  return { response, body };
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const email = requireEnv("TENANT_A_EMAIL");
  const password = requireEnv("TENANT_A_PASSWORD");

  const unauthorized = await requestMe(baseUrl);
  if (unauthorized.response.status !== 401 || unauthorized.body.ok !== false) {
    fail(`Expected unauthorized /api/me response, got status=${unauthorized.response.status}`);
  }
  pass("/api/me requires auth token.");

  const tenant = await signIn({ email, password });
  const authorized = await requestMe(baseUrl, tenant.accessToken);
  if (authorized.response.status !== 200 || authorized.body.ok !== true || !authorized.body.data) {
    fail(
      `Expected authenticated /api/me response, got status=${authorized.response.status}, body=${JSON.stringify(authorized.body)}`,
    );
  }

  if (authorized.body.data.user.id !== tenant.authUserId) {
    fail("Returned /api/me user.id does not match authenticated user.");
  }
  if (authorized.body.data.tenant.id !== tenant.companyId) {
    fail("Returned /api/me tenant.id does not match tenant context.");
  }
  if (!Array.isArray(authorized.body.data.permissions)) {
    fail("Returned /api/me permissions is not an array.");
  }
  if (authorized.body.data.employee) {
    if (
      !authorized.body.data.employee.id ||
      !authorized.body.data.employee.first_name ||
      !authorized.body.data.employee.last_name ||
      !authorized.body.data.employee.email
    ) {
      fail("Returned /api/me employee object is missing required safe fields.");
    }
  }
  pass("/api/me returns user, tenant, permissions and safe employee payload.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
