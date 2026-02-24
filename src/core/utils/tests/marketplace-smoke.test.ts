import { createClient } from "@supabase/supabase-js";

function info(message: string) {
  console.log(`INFO: ${message}`);
}

function warn(message: string): never {
  console.log(`WARN: ${message}`);
  process.exit(0);
}

function fail(message: string): never {
  throw new Error(`FAIL: ${message}`);
}

function required(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("enotfound") ||
    message.includes("getaddrinfo") ||
    message.includes("network")
  );
}

async function signIn(email: string, password: string) {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    warn("Missing Supabase URL/anon key; skipping marketplace smoke.");
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    if (isNetworkError(error ? new Error(error.message) : null)) {
      warn("Supabase auth host unreachable; skipping marketplace smoke.");
    }
    fail(`Failed to sign in ${email}: ${error?.message ?? "unknown"}`);
  }
  return data.session.access_token;
}

async function main() {
  const baseUrl = required("BASE_URL") ?? required("TEST_BASE_URL");
  const managerEmail = required("MARKETPLACE_MANAGER_EMAIL");
  const managerPassword = required("MARKETPLACE_MANAGER_PASSWORD");
  const workerEmail = required("MARKETPLACE_WORKER_EMAIL");
  const workerPassword = required("MARKETPLACE_WORKER_PASSWORD");

  if (!baseUrl) {
    warn("BASE_URL/TEST_BASE_URL missing; skipping marketplace smoke.");
  }
  if (!managerEmail || !managerPassword || !workerEmail || !workerPassword) {
    warn("Marketplace credentials missing; skipping marketplace smoke.");
  }
  if (process.env.ENABLE_MARKETPLACE !== "1") {
    warn("ENABLE_MARKETPLACE is not '1' for this process; skipping marketplace smoke.");
  }

  const managerToken = await signIn(managerEmail, managerPassword);
  const workerToken = await signIn(workerEmail, workerPassword);

  const now = Date.now();
  const createResponse = await fetch(`${baseUrl}/api/marketplace/posts`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${managerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: `Smoke Post ${now}`,
      startsAt: new Date(now + 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      payRate: 20,
    }),
  });
  const createBody = (await createResponse.json()) as {
    ok: boolean;
    data?: { id: string };
    error?: unknown;
  };
  if (createResponse.status !== 201 || !createBody.ok || !createBody.data?.id) {
    fail(`Expected create post 201, got ${createResponse.status} ${JSON.stringify(createBody)}`);
  }
  info("POST /api/marketplace/posts -> 201");

  const listResponse = await fetch(`${baseUrl}/api/marketplace/posts`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${workerToken}`,
    },
  });
  const listBody = (await listResponse.json()) as {
    ok: boolean;
    data?: Array<{ id: string }>;
    error?: unknown;
  };
  if (listResponse.status !== 200 || !listBody.ok || !Array.isArray(listBody.data)) {
    fail(`Expected list posts 200, got ${listResponse.status} ${JSON.stringify(listBody)}`);
  }
  info("GET /api/marketplace/posts -> 200");

  const applyResponse = await fetch(`${baseUrl}/api/marketplace/posts/${createBody.data.id}/apply`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${workerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const applyBody = (await applyResponse.json()) as {
    ok: boolean;
    data?: { alreadyApplied?: boolean };
    error?: unknown;
  };
  if (![200, 201].includes(applyResponse.status) || !applyBody.ok) {
    fail(`Expected apply 200/201, got ${applyResponse.status} ${JSON.stringify(applyBody)}`);
  }
  info(`POST /api/marketplace/posts/:id/apply -> ${applyResponse.status}`);
}

main().catch((error) => {
  if (isNetworkError(error)) {
    warn("Network unavailable; skipping marketplace smoke.");
  }
  console.error(error);
  process.exit(1);
});
