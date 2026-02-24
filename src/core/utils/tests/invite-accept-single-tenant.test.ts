import { createHash, randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { POST as acceptInvitePost } from "../../../app/api/invites/accept/route";

interface OwnerTenantFixture {
  email: string;
  password: string;
  accessToken: string;
  authUserId: string;
  companyId: string;
  profileId: string;
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

function hasRequiredEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function isUpstreamUnreachableMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("enotfound") ||
    normalized.includes("auth host unreachable") ||
    normalized.includes("getaddrinfo") ||
    normalized.includes("network")
  );
}

function isUpstreamUnreachable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return isUpstreamUnreachableMessage(error.message);
}

async function createInvite(
  createSupabaseClientWithAccessToken: (accessToken: string) => {
    from: (table: string) => any;
  },
  isMissingRelationError: (message: string | undefined) => boolean,
  params: {
    ownerAccessToken: string;
    ownerAuthUserId: string;
    companyId: string;
    email: string;
  },
): Promise<{ rawToken: string; employeeId: string }> {
  const ownerClient = createSupabaseClientWithAccessToken(params.ownerAccessToken);
  const nowIso = new Date().toISOString();

  const { data: employee, error: employeeError } = await ownerClient
    .from("employees")
    .insert({
      tenant_id: params.companyId,
      first_name: "Invite",
      last_name: "Target",
      email: params.email,
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();

  if (employeeError || !employee?.id) {
    if (isUpstreamUnreachableMessage(employeeError?.message ?? "")) {
      skip("Supabase upstream unreachable while creating employee invite fixture.");
    }
    if (isMissingRelationError(employeeError?.message)) {
      skip("Employees schema missing. Apply migration 0005 before running invite acceptance tests.");
    }
    fail(`Failed to create invite employee: ${employeeError?.message ?? "unknown"}`);
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const { error: inviteError } = await ownerClient.from("employee_invites").insert({
    tenant_id: params.companyId,
    employee_id: employee.id,
    email: params.email.toLowerCase(),
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: "pending",
    created_by: params.ownerAuthUserId,
    created_at: nowIso,
  });

  if (inviteError) {
    if (isUpstreamUnreachableMessage(inviteError.message)) {
      skip("Supabase upstream unreachable while creating invite row.");
    }
    if (isMissingRelationError(inviteError.message)) {
      skip("employee_invites schema missing. Apply migration 0005 before running invite acceptance tests.");
    }
    fail(`Failed to create invite row: ${inviteError.message}`);
  }

  return { rawToken, employeeId: employee.id };
}

async function signUpAndSignIn(
  createAuthClient: () => {
    auth: {
      signUp: (payload: { email: string; password: string }) => Promise<{ error: { message: string } | null }>;
      signInWithPassword: (payload: {
        email: string;
        password: string;
      }) => Promise<{
        data: { user: { id: string } | null; session: { access_token: string } | null };
        error: { message: string } | null;
      }>;
    };
  },
  email: string,
  password: string,
): Promise<{ userId: string; accessToken: string }> {
  const authClient = createAuthClient();
  const { error: signUpError } = await authClient.auth.signUp({ email, password });
  if (signUpError && !signUpError.message.toLowerCase().includes("already registered")) {
    if (isUpstreamUnreachableMessage(signUpError.message)) {
      skip("Supabase upstream unreachable while signing up invite user.");
    }
    fail(`Failed to sign up invite user ${email}: ${signUpError.message}`);
  }

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.user?.id || !data.session?.access_token) {
    if (isUpstreamUnreachableMessage(error?.message ?? "")) {
      skip("Supabase upstream unreachable while signing in invite user.");
    }
    fail(`Failed to sign in invite user ${email}: ${error?.message ?? "unknown"}`);
  }

  return {
    userId: data.user.id,
    accessToken: data.session.access_token,
  };
}

async function callAcceptInvite(accessToken: string, token: string) {
  const request = new NextRequest("http://localhost/api/invites/accept", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token }),
  });

  const response = await acceptInvitePost(request);
  const body = (await response.json()) as {
    ok: boolean;
    data?: { employeeId: string; tenantId: string };
    error?: string | { code?: string; message?: string };
  };

  const errorMessage =
    typeof body.error === "string" ? body.error : body.error?.message ?? body.error?.code ?? "";
  if (isUpstreamUnreachableMessage(errorMessage)) {
    skip("Supabase upstream unreachable while calling invite accept route.");
  }

  return { response, body };
}

async function main() {
  if (!hasRequiredEnv()) {
    skip("Missing Supabase env vars; skipping invite accept integration test.");
  }

  const helpers = await import("./test-helpers");
  const supabaseModule = await import("../../db/supabase");

  const {
    createAuthClient,
    createOwnerTenantFixture,
    isMissingRelationError,
  } = helpers;
  const { createSupabaseClientWithAccessToken } = supabaseModule;

  let ownerA: OwnerTenantFixture;
  let ownerB: OwnerTenantFixture;
  try {
    ownerA = await createOwnerTenantFixture({
      companyName: `Apple Workspace ${Date.now()}`,
      firstName: "Owner",
      lastName: "Apple",
      emailPrefix: "owner-apple",
    });

    ownerB = await createOwnerTenantFixture({
      companyName: `Amazon Workspace ${Date.now()}`,
      firstName: "Owner",
      lastName: "Amazon",
      emailPrefix: "owner-amazon",
    });
  } catch (error) {
    if (isUpstreamUnreachable(error)) {
      skip("Supabase auth host unreachable from test runtime.");
    }
    throw error;
  }

  const userWithoutCompanyEmail = `invitee-${Date.now()}@example.test`;
  const userWithoutCompanyPassword = "Invitee123!";
  const userWithoutCompany = await signUpAndSignIn(
    createAuthClient,
    userWithoutCompanyEmail,
    userWithoutCompanyPassword,
  );

  const pendingInviteForNewUser = await createInvite(
    createSupabaseClientWithAccessToken,
    isMissingRelationError,
    {
      ownerAccessToken: ownerA.accessToken,
      ownerAuthUserId: ownerA.authUserId,
      companyId: ownerA.companyId,
      email: userWithoutCompanyEmail,
    },
  );

  const firstAccept = await callAcceptInvite(
    userWithoutCompany.accessToken,
    pendingInviteForNewUser.rawToken,
  );
  if (firstAccept.response.status !== 200 || !firstAccept.body.ok) {
    fail(
      `Expected first invite accept to succeed with 200, got ${firstAccept.response.status} ${JSON.stringify(firstAccept.body)}`,
    );
  }

  const userWithoutCompanyClient = createSupabaseClientWithAccessToken(userWithoutCompany.accessToken);
  const { data: linkedUser, error: linkedUserError } = await userWithoutCompanyClient
    .from("users")
    .select("company_id")
    .eq("auth_user_id", userWithoutCompany.userId)
    .single();

  if (linkedUserError || !linkedUser?.company_id) {
    if (isUpstreamUnreachableMessage(linkedUserError?.message ?? "")) {
      skip("Supabase upstream unreachable while verifying users.company_id.");
    }
    fail(`Expected accepted invite to create/link users row: ${linkedUserError?.message ?? "unknown"}`);
  }

  if (linkedUser.company_id !== ownerA.companyId) {
    fail(
      `Expected users.company_id=${ownerA.companyId} after acceptance, got ${linkedUser.company_id}`,
    );
  }
  pass("Invite accept links a user with NULL company pointer to invite workspace.");

  const idempotentAccept = await callAcceptInvite(
    userWithoutCompany.accessToken,
    pendingInviteForNewUser.rawToken,
  );
  if (idempotentAccept.response.status !== 200 || !idempotentAccept.body.ok) {
    fail(
      `Expected idempotent invite accept to return 200, got ${idempotentAccept.response.status} ${JSON.stringify(idempotentAccept.body)}`,
    );
  }
  pass("Invite accept is idempotent when user is already in the invited workspace.");

  const crossTenantInvite = await createInvite(
    createSupabaseClientWithAccessToken,
    isMissingRelationError,
    {
      ownerAccessToken: ownerA.accessToken,
      ownerAuthUserId: ownerA.authUserId,
      companyId: ownerA.companyId,
      email: ownerB.email,
    },
  );

  const differentCompanyAccept = await callAcceptInvite(ownerB.accessToken, crossTenantInvite.rawToken);
  if (differentCompanyAccept.response.status !== 409 || differentCompanyAccept.body.ok) {
    fail(
      `Expected cross-company invite accept to return 409, got ${differentCompanyAccept.response.status} ${JSON.stringify(differentCompanyAccept.body)}`,
    );
  }

  const errorCode =
    typeof differentCompanyAccept.body.error === "object"
      ? differentCompanyAccept.body.error.code
      : undefined;

  if (errorCode !== "user-already-in-company") {
    fail(`Expected error code user-already-in-company, got ${errorCode ?? "undefined"}`);
  }
  pass("Invite accept rejects users already associated with a different workspace.");
}

main().catch((error) => {
  if (isUpstreamUnreachable(error)) {
    skip("Supabase auth host unreachable from test runtime.");
  }
  console.error(error);
  process.exit(1);
});
