interface HttpResult {
  status: number;
  location: string | null;
  bodyText: string;
}

function pass(message: string) {
  console.log(`PASS: ${message}`);
}

function fail(message: string): never {
  throw new Error(`FAIL: ${message}`);
}

async function request(url: string, options?: RequestInit): Promise<HttpResult> {
  const response = await fetch(url, { redirect: "manual", ...options });
  return {
    status: response.status,
    location: response.headers.get("location"),
    bodyText: await response.text(),
  };
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

  const protectedPage = await request(`${baseUrl}/dashboard`);
  if (![307, 308].includes(protectedPage.status) || !protectedPage.location?.includes("/login")) {
    fail(
      `Expected /dashboard to redirect to /login. Got status=${protectedPage.status}, location=${protectedPage.location}`,
    );
  }
  pass("Protected layout redirects unauthenticated users to /login.");

  const protectedApi = await request(`${baseUrl}/api/protected/me`);
  if (protectedApi.status !== 401) {
    fail(`Expected /api/protected/me to return 401, got ${protectedApi.status}`);
  }
  pass("Protected API route enforces server-side auth with 401.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
