/**
 * Local test setup:
 * 1. Copy `.env.test.local.example` -> `.env.test.local`
 * 2. Fill TENANT_A_EMAIL and TENANT_A_PASSWORD
 * 3. Start app: npm run dev
 * 4. Run: npm run test:me
 */
import { createAuthClient, fail, makeUniqueEmail, pass, requireEnv, signIn } from "./test-helpers";
import { resolvePostLoginRoute } from "../../auth/post-login-routing";

interface MeApiResponse {
  ok: boolean;
  data?: {
    user: { id: string; email: string | null; name: string | null };
    tenant: { id: string; name: string | null } | null;
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
  if (!authorized.body.data.tenant || authorized.body.data.tenant.id !== tenant.companyId) {
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

  const unlinkedEmail = makeUniqueEmail("me-unlinked");
  const unlinkedPassword = "MeUnlinked123!";
  const authClient = createAuthClient();

  const { error: unlinkedSignupError } = await authClient.auth.signUp({
    email: unlinkedEmail,
    password: unlinkedPassword,
  });
  if (unlinkedSignupError) {
    fail(`Failed to sign up unlinked me-sanity user: ${unlinkedSignupError.message}`);
  }

  const { data: unlinkedSignInData, error: unlinkedSignInError } = await authClient.auth.signInWithPassword({
    email: unlinkedEmail,
    password: unlinkedPassword,
  });
  if (unlinkedSignInError || !unlinkedSignInData.session?.access_token) {
    fail(`Failed to sign in unlinked me-sanity user: ${unlinkedSignInError?.message ?? "unknown"}`);
  }

  const unlinkedResponse = await requestMe(baseUrl, unlinkedSignInData.session.access_token);
  if (unlinkedResponse.response.status !== 200 || !unlinkedResponse.body.ok || !unlinkedResponse.body.data) {
    fail(
      `Expected linked /api/me success for unlinked user, got status=${unlinkedResponse.response.status}, body=${JSON.stringify(unlinkedResponse.body)}`,
    );
  }
  if (unlinkedResponse.body.data.tenant !== null || unlinkedResponse.body.data.employee !== null) {
    fail("/api/me should return tenant=null and employee=null for unlinked users.");
  }

  const target = resolvePostLoginRoute(unlinkedResponse.body.data);
  if (target !== "/onboarding") {
    fail(`Expected unlinked post-login route to /onboarding, got ${target}`);
  }
  pass("/api/me tenant=null employee=null routes to /onboarding.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
