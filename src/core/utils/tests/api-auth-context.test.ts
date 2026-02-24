import { NextRequest } from "next/server";
import { POST as testLoginPost } from "../../../app/api/test/login/route";
import { GET as meGet } from "../../../app/api/me/route";
import { fail, pass, requireEnv, skip } from "./test-helpers";

interface LoginResponse {
  ok: boolean;
  data?: {
    userId: string;
    accessToken: string | null;
  };
  error?: string;
}

interface DebugAuthResponse {
  ok: boolean;
  data?: {
    auth_uid: string | null;
    auth_role: string | null;
    jwt: string | null;
    headers: string | null;
  };
  error?: { message?: string } | string;
}

function buildCookieHeader(cookies: Array<{ name: string; value: string }>): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function extractSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const fromMethod = withGetSetCookie.getSetCookie?.() ?? [];
  if (fromMethod.length > 0) {
    return fromMethod;
  }

  const raw = headers.get("set-cookie");
  if (!raw) {
    return [];
  }

  return raw.split(/,(?=[^;,]+=)/g).map((value) => value.trim()).filter((value) => value.length > 0);
}

function cookieHeaderFromSetCookie(setCookies: string[]): string {
  return setCookies
    .map((entry) => entry.split(";")[0]?.trim() ?? "")
    .filter((entry) => entry.length > 0)
    .join("; ");
}

async function runHttpIntegrationIfBaseUrl(params: { email: string; password: string }) {
  const baseUrl = process.env.BASE_URL ?? process.env.TEST_BASE_URL ?? "";
  if (!baseUrl) {
    pass("HTTP integration path skipped (BASE_URL/TEST_BASE_URL not provided).");
    return;
  }

  const loginResponse = await fetch(`${baseUrl}/api/test/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: params.email, password: params.password }),
  });
  const loginBody = (await loginResponse.json()) as LoginResponse;
  if (loginResponse.status === 503 && loginBody.error === "auth-upstream-unreachable") {
    skip("Supabase auth host unreachable from HTTP integration runtime.");
  }
  if (loginResponse.status !== 200 || !loginBody.ok || !loginBody.data?.userId) {
    fail(`Expected HTTP login to succeed, got status=${loginResponse.status}, body=${JSON.stringify(loginBody)}`);
  }

  const setCookies = extractSetCookies(loginResponse.headers);
  if (setCookies.length === 0) {
    fail("Expected HTTP login response to include Set-Cookie headers.");
  }
  const cookieHeader = cookieHeaderFromSetCookie(setCookies);
  if (!cookieHeader) {
    fail("Expected parsable Cookie header from Set-Cookie.");
  }

  const debugResponse = await fetch(`${baseUrl}/api/me?debugAuth=1`, {
    method: "GET",
    headers: { Cookie: cookieHeader },
  });
  if (debugResponse.status === 404) {
    skip("debugAuth endpoint is disabled for this runtime (expected outside dev/test).");
  }
  const debugBody = (await debugResponse.json()) as DebugAuthResponse;
  if (debugResponse.status !== 200 || !debugBody.ok || !debugBody.data) {
    fail(`Expected HTTP debug auth to return 200, got status=${debugResponse.status}, body=${JSON.stringify(debugBody)}`);
  }
  if (debugBody.data.auth_uid !== loginBody.data.userId) {
    fail(`Expected HTTP debug auth_uid=${loginBody.data.userId}, got ${debugBody.data.auth_uid ?? "null"}`);
  }
  pass("HTTP cookie flow keeps auth.uid available in debug RPC.");
}

async function main() {
  process.env.ENABLE_TEST_AUTH_ROUTES = "1";
  process.env.ENABLE_DEBUG_AUTH = "1";

  const email = requireEnv("TENANT_A_EMAIL");
  const password = requireEnv("TENANT_A_PASSWORD");

  await runHttpIntegrationIfBaseUrl({ email, password });

  const loginRequest = new NextRequest("http://localhost/api/test/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginResponse = await testLoginPost(loginRequest);
  const loginBody = (await loginResponse.json()) as LoginResponse;
  if (loginResponse.status === 503 && loginBody.error === "auth-upstream-unreachable") {
    skip("Supabase auth host unreachable from test runtime.");
  }
  if (loginResponse.status !== 200 || !loginBody.ok || !loginBody.data?.userId) {
    fail(`Expected login to succeed, got status=${loginResponse.status}, body=${JSON.stringify(loginBody)}`);
  }

  const cookieHeader = buildCookieHeader(loginResponse.cookies.getAll());
  if (!cookieHeader) {
    fail("Expected test login route to set auth cookies.");
  }

  const cookieDebugRequest = new NextRequest("http://localhost/api/me?debugAuth=1", {
    method: "GET",
    headers: { cookie: cookieHeader },
  });
  const cookieDebugResponse = await meGet(cookieDebugRequest);
  const cookieDebugBody = (await cookieDebugResponse.json()) as DebugAuthResponse;
  if (cookieDebugResponse.status !== 200 || !cookieDebugBody.ok || !cookieDebugBody.data) {
    fail(
      `Expected cookie debug auth to return 200, got status=${cookieDebugResponse.status}, body=${JSON.stringify(cookieDebugBody)}`,
    );
  }
  if (cookieDebugBody.data.auth_uid !== loginBody.data.userId) {
    fail(
      `Expected cookie debug auth_uid=${loginBody.data.userId}, got ${cookieDebugBody.data.auth_uid ?? "null"}`,
    );
  }
  pass("Cookie-auth debug RPC returns auth_uid for current user session.");

  const accessToken = loginBody.data.accessToken;
  if (!accessToken) {
    fail("Expected login route to return access token for bearer verification.");
  }

  const bearerDebugRequest = new NextRequest("http://localhost/api/me?debugAuth=1", {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  const bearerDebugResponse = await meGet(bearerDebugRequest);
  const bearerDebugBody = (await bearerDebugResponse.json()) as DebugAuthResponse;
  if (bearerDebugResponse.status !== 200 || !bearerDebugBody.ok || !bearerDebugBody.data) {
    fail(
      `Expected bearer debug auth to return 200, got status=${bearerDebugResponse.status}, body=${JSON.stringify(bearerDebugBody)}`,
    );
  }
  if (bearerDebugBody.data.auth_uid !== loginBody.data.userId) {
    fail(`Expected bearer debug auth_uid=${loginBody.data.userId}, got ${bearerDebugBody.data.auth_uid ?? "null"}`);
  }
  pass("Bearer debug RPC returns auth_uid for current user token.");

  const noAuthRequest = new NextRequest("http://localhost/api/me?debugAuth=1", { method: "GET" });
  const noAuthResponse = await meGet(noAuthRequest);
  if (noAuthResponse.status !== 401) {
    const body = await noAuthResponse.text();
    fail(`Expected 401 for unauthenticated debug auth call, got ${noAuthResponse.status}. body=${body}`);
  }
  pass("Debug auth endpoint remains protected for unauthenticated calls.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
