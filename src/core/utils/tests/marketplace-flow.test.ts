import { createClient } from "@supabase/supabase-js";

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

async function signIn(email: string, password: string): Promise<string> {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const anon = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon) {
    skip("Missing Supabase URL/anon key.");
  }
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    if (isNetworkError(error ? new Error(error.message) : null)) {
      skip("Supabase auth unreachable.");
    }
    fail(`Sign-in failed for ${email}: ${error?.message ?? "unknown"}`);
  }
  return data.session.access_token;
}

async function api<T>(baseUrl: string, path: string, token: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json()) as T;
  return { status: response.status, body };
}

async function main() {
  const baseUrl = required("BASE_URL") ?? required("TEST_BASE_URL");
  const managerEmail = required("MARKETPLACE_MANAGER_EMAIL");
  const managerPassword = required("MARKETPLACE_MANAGER_PASSWORD");
  const workerEmail = required("MARKETPLACE_WORKER_EMAIL");
  const workerPassword = required("MARKETPLACE_WORKER_PASSWORD");

  if (!baseUrl || !managerEmail || !managerPassword || !workerEmail || !workerPassword) {
    skip("Missing marketplace flow env vars.");
  }

  process.env.ENABLE_MARKETPLACE = "1";

  const managerToken = await signIn(managerEmail, managerPassword);
  const workerToken = await signIn(workerEmail, workerPassword);

  const now = Date.now();
  const createPost = await api<{ ok: boolean; data?: { id: string }; error?: string }>(
    baseUrl,
    "/api/marketplace/posts",
    managerToken,
    {
      method: "POST",
      body: JSON.stringify({
        title: `Flow Post ${now}`,
        startsAt: new Date(now + 60 * 60 * 1000).toISOString(),
        endsAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
        payRate: 22,
      }),
    },
  );
  if (createPost.status !== 201 || !createPost.body.ok || !createPost.body.data?.id) {
    fail(`Create post failed: ${createPost.status} ${JSON.stringify(createPost.body)}`);
  }
  const postId = createPost.body.data.id;
  pass("Manager created post.");

  const listPosts = await api<{ ok: boolean; data?: Array<{ id: string }> }>(
    baseUrl,
    "/api/marketplace/posts",
    workerToken,
    { method: "GET" },
  );
  if (listPosts.status !== 200 || !listPosts.body.ok) {
    fail(`Worker list posts failed: ${listPosts.status}`);
  }
  pass("Worker listed posts.");

  const apply = await api<{ ok: boolean; data?: { postId?: string } }>(
    baseUrl,
    `/api/marketplace/posts/${postId}/apply`,
    workerToken,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (![200, 201].includes(apply.status) || !apply.body.ok) {
    fail(`Worker apply failed: ${apply.status} ${JSON.stringify(apply.body)}`);
  }
  pass("Worker applied.");

  const applications = await api<{ ok: boolean; data?: Array<{ workerUserId: string }> }>(
    baseUrl,
    `/api/marketplace/posts/${postId}/applications`,
    managerToken,
    { method: "GET" },
  );
  if (applications.status !== 200 || !applications.body.ok || !applications.body.data?.[0]?.workerUserId) {
    fail(`Manager applications list failed: ${applications.status} ${JSON.stringify(applications.body)}`);
  }
  const workerUserId = applications.body.data[0].workerUserId;
  pass("Manager viewed applications.");

  const accept = await api<{ ok: boolean; data?: { id?: string } }>(
    baseUrl,
    `/api/marketplace/posts/${postId}/accept`,
    managerToken,
    { method: "POST", body: JSON.stringify({ workerUserId }) },
  );
  if (![200, 201].includes(accept.status) || !accept.body.ok || !accept.body.data?.id) {
    fail(`Manager accept failed: ${accept.status} ${JSON.stringify(accept.body)}`);
  }
  const assignmentId = accept.body.data.id;
  pass("Manager accepted and assignment created.");

  const myActive = await api<{ ok: boolean; data?: Array<{ id: string }> }>(
    baseUrl,
    "/api/my/marketplace/assignments?status=active",
    workerToken,
    { method: "GET" },
  );
  if (myActive.status !== 200 || !myActive.body.ok || !myActive.body.data?.some((row) => row.id === assignmentId)) {
    fail(`Worker active assignments missing assignment: ${myActive.status} ${JSON.stringify(myActive.body)}`);
  }
  pass("Worker sees active assignment.");

  const complete = await api<{ ok: boolean }>(
    baseUrl,
    `/api/marketplace/assignments/${assignmentId}/complete`,
    managerToken,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (complete.status !== 200 || !complete.body.ok) {
    fail(`Manager complete failed: ${complete.status} ${JSON.stringify(complete.body)}`);
  }
  pass("Manager completed assignment.");

  const history = await api<{ ok: boolean; data?: Array<{ id: string }> }>(
    baseUrl,
    "/api/my/marketplace/history",
    workerToken,
    { method: "GET" },
  );
  if (history.status !== 200 || !history.body.ok || !history.body.data?.some((row) => row.id === assignmentId)) {
    fail(`Worker history missing assignment: ${history.status} ${JSON.stringify(history.body)}`);
  }
  pass("Worker sees completed assignment in history.");
}

main().catch((error) => {
  if (isNetworkError(error)) {
    skip("Network unreachable.");
  }
  console.error(error);
  process.exit(1);
});
