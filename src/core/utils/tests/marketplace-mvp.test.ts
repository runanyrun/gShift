import { NextRequest } from "next/server";
import { GET as listMarketplacePosts, POST as createMarketplacePost } from "../../../app/api/marketplace/posts/route";
import { POST as applyMarketplacePost } from "../../../app/api/marketplace/posts/[id]/apply/route";

interface AuthSession {
  userId: string;
  accessToken: string;
}

function pass(message: string) {
  console.log(`PASS: ${message}`);
}

function skip(message: string): never {
  console.log(`SKIP: ${message}`);
  process.exit(0);
}

function fail(message: string): never {
  throw new Error(`FAIL: ${message}`);
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

async function signIn(email: string, password: string): Promise<AuthSession> {
  const helpers = await import("./test-helpers");
  const authClient = helpers.createAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.user?.id || !data.session?.access_token) {
    if (isNetworkError(error ? new Error(error.message) : null)) {
      skip("Supabase auth host unreachable from test runtime.");
    }
    fail(`Failed to sign in ${email}: ${error?.message ?? "unknown"}`);
  }
  return {
    userId: data.user.id,
    accessToken: data.session.access_token,
  };
}

function authHeaders(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function main() {
  const managerEmail = process.env.MARKETPLACE_MANAGER_EMAIL;
  const managerPassword = process.env.MARKETPLACE_MANAGER_PASSWORD;
  const workerEmail = process.env.MARKETPLACE_WORKER_EMAIL;
  const workerPassword = process.env.MARKETPLACE_WORKER_PASSWORD;

  if (!managerEmail || !managerPassword || !workerEmail || !workerPassword) {
    skip("Marketplace credentials are missing; set MARKETPLACE_MANAGER/WORKER env vars.");
  }

  let manager: AuthSession;
  let worker: AuthSession;
  try {
    manager = await signIn(managerEmail, managerPassword);
    worker = await signIn(workerEmail, workerPassword);
  } catch (error) {
    if (isNetworkError(error)) {
      skip("Supabase auth host unreachable from test runtime.");
    }
    throw error;
  }

  const previousFlag = process.env.ENABLE_MARKETPLACE;
  process.env.ENABLE_MARKETPLACE = "0";
  const disabledRequest = new NextRequest("http://localhost/api/marketplace/posts", {
    method: "GET",
    headers: authHeaders(worker.accessToken),
  });
  const disabledResponse = await listMarketplacePosts(disabledRequest);
  if (disabledResponse.status !== 404) {
    const body = await disabledResponse.text();
    fail(`Expected 404 when marketplace flag disabled, got ${disabledResponse.status}. body=${body}`);
  }
  pass("Marketplace routes are closed when ENABLE_MARKETPLACE is not enabled.");

  process.env.ENABLE_MARKETPLACE = "1";
  const now = Date.now();
  const createRequest = new NextRequest("http://localhost/api/marketplace/posts", {
    method: "POST",
    headers: authHeaders(manager.accessToken),
    body: JSON.stringify({
      title: `MVP Shift ${now}`,
      startsAt: new Date(now + 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
      payRate: 18,
    }),
  });
  const createResponse = await createMarketplacePost(createRequest);
  const createBody = (await createResponse.json()) as {
    ok: boolean;
    data?: { id: string };
    error?: string;
  };
  if (createResponse.status !== 201 || !createBody.ok || !createBody.data?.id) {
    fail(`Expected manager post creation 201, got ${createResponse.status} ${JSON.stringify(createBody)}`);
  }
  const createdPostId = createBody.data.id;
  pass("Management user can create marketplace posts.");

  const listRequest = new NextRequest("http://localhost/api/marketplace/posts", {
    method: "GET",
    headers: authHeaders(worker.accessToken),
  });
  const listResponse = await listMarketplacePosts(listRequest);
  const listBody = (await listResponse.json()) as {
    ok: boolean;
    data?: Array<{ id: string }>;
    error?: string;
  };
  if (listResponse.status !== 200 || !listBody.ok) {
    fail(`Expected worker list posts 200, got ${listResponse.status} ${JSON.stringify(listBody)}`);
  }
  if (!Array.isArray(listBody.data) || listBody.data.every((post) => post.id !== createdPostId)) {
    fail("Expected worker list response to include the created marketplace post.");
  }
  pass("Worker can list marketplace posts.");

  const applyRequest = new NextRequest(`http://localhost/api/marketplace/posts/${createdPostId}/apply`, {
    method: "POST",
    headers: authHeaders(worker.accessToken),
    body: JSON.stringify({}),
  });
  const applyResponse = await applyMarketplacePost(applyRequest, {
    params: Promise.resolve({ id: createdPostId }),
  });
  const applyBody = (await applyResponse.json()) as {
    ok: boolean;
    data?: { postId?: string };
    error?: string;
  };
  if (![200, 201].includes(applyResponse.status) || !applyBody.ok) {
    fail(`Expected worker apply 200/201, got ${applyResponse.status} ${JSON.stringify(applyBody)}`);
  }
  pass("Worker can apply to marketplace post.");

  process.env.ENABLE_MARKETPLACE = previousFlag;
}

main().catch((error) => {
  if (isNetworkError(error)) {
    skip("Supabase auth host unreachable from test runtime.");
  }
  console.error(error);
  process.exit(1);
});
