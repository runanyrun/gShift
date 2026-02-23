import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env";

interface TenantCredentials {
  email: string;
  password: string;
}

interface TenantSession {
  accessToken: string;
  authUserId: string;
  companyId: string;
}

function createAnonClient(accessToken: string) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function signIn(credentials: TenantCredentials): Promise<TenantSession> {
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.user || !data.session?.access_token) {
    throw new Error(`Failed to sign in ${credentials.email}: ${error?.message ?? "unknown"}`);
  }

  const sessionClient = createAnonClient(data.session.access_token);
  const { data: profile, error: profileError } = await sessionClient
    .from("users")
    .select("company_id")
    .eq("auth_user_id", data.user.id)
    .single();

  if (profileError || !profile?.company_id) {
    throw new Error(`Failed to load profile company for ${credentials.email}`);
  }

  return {
    accessToken: data.session.access_token,
    authUserId: data.user.id,
    companyId: profile.company_id,
  };
}

async function main() {
  const tenantAEmail = process.env.TENANT_A_EMAIL;
  const tenantAPassword = process.env.TENANT_A_PASSWORD;
  const tenantBEmail = process.env.TENANT_B_EMAIL;
  const tenantBPassword = process.env.TENANT_B_PASSWORD;

  if (!tenantAEmail || !tenantAPassword || !tenantBEmail || !tenantBPassword) {
    throw new Error(
      "Missing TENANT_A_EMAIL/TENANT_A_PASSWORD/TENANT_B_EMAIL/TENANT_B_PASSWORD env vars.",
    );
  }

  const [tenantA, tenantB] = await Promise.all([
    signIn({ email: tenantAEmail, password: tenantAPassword }),
    signIn({ email: tenantBEmail, password: tenantBPassword }),
  ]);

  if (tenantA.companyId === tenantB.companyId) {
    throw new Error("Test setup invalid: tenants must belong to different companies.");
  }

  const tenantAClient = createAnonClient(tenantA.accessToken);
  const { data: aVisibleUsers, error: aSelectError } = await tenantAClient
    .from("users")
    .select("company_id");
  if (aSelectError) {
    throw new Error(`Tenant A select failed: ${aSelectError.message}`);
  }
  if (aVisibleUsers.some((row) => row.company_id !== tenantA.companyId)) {
    throw new Error("Tenant A can see users outside its own company.");
  }

  const { error: aInsertError } = await tenantAClient.from("shifts").insert({
    company_id: tenantB.companyId,
    user_id: "00000000-0000-0000-0000-000000000000",
    starts_at: new Date(Date.now() + 3600000).toISOString(),
    ends_at: new Date(Date.now() + 7200000).toISOString(),
    created_by: tenantA.authUserId,
  });
  if (!aInsertError) {
    throw new Error("Tenant A managed to insert a shift for tenant B company_id.");
  }

  const bootstrapResponse = await fetch("http://localhost:3000/api/dashboard/bootstrap", {
    headers: {
      Authorization: `Bearer ${tenantA.accessToken}`,
    },
  });
  const bootstrapBody = (await bootstrapResponse.json()) as {
    user?: { companyId?: string };
    company?: { id?: string };
    error?: string;
  };
  if (!bootstrapResponse.ok) {
    throw new Error(`Dashboard bootstrap failed: ${bootstrapBody.error ?? "unknown"}`);
  }
  if (
    bootstrapBody.user?.companyId !== tenantA.companyId ||
    bootstrapBody.company?.id !== tenantA.companyId
  ) {
    throw new Error("Dashboard bootstrap leaked cross-tenant context.");
  }

  console.log("cross-tenant-isolation: all checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
