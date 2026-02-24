import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserTenantContext } from "../../../core/auth/current-user";
import { MeResponseData } from "../../../core/auth/me.types";
import { createSupabaseClientWithAccessToken } from "../../../core/db/supabase";
import { getAuthenticatedUserFromCookies } from "../../../core/auth/server-auth";
import { applyResponseCookies } from "../../../core/auth/supabase-server-client";

function permissionSetFromRole(role: "owner" | "admin" | "manager" | "employee"): Set<string> {
  if (role === "owner" || role === "admin") {
    return new Set([
      "administration",
      "management",
      "report_management",
      "time_off_management",
      "timesheet_management",
    ]);
  }
  if (role === "manager") {
    return new Set([
      "management",
      "report_management",
      "time_off_management",
      "timesheet_management",
    ]);
  }
  return new Set();
}

// QSFT-9: canonical tenant-safe current user info endpoint.
export async function GET(request: NextRequest) {
  let cookieAuthResponse: NextResponse | undefined;
  try {
    const authHeader = request.headers.get("authorization");
    const bearerAccessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    let supabase = null as ReturnType<typeof createSupabaseClientWithAccessToken> | null;
    let authUserId: string | null = null;
    let authUserEmail: string | null = null;

    const cookieAuth = await getAuthenticatedUserFromCookies(request);
    cookieAuthResponse = cookieAuth.response;
    if (cookieAuth.supabase && cookieAuth.user) {
      supabase = cookieAuth.supabase;
      authUserId = cookieAuth.user.id;
      authUserEmail = cookieAuth.user.email ?? null;
    }

    if (!supabase && bearerAccessToken) {
      const bearerClient = createSupabaseClientWithAccessToken(bearerAccessToken);
      const { data, error } = await bearerClient.auth.getUser();
      if (!error && data.user) {
        supabase = bearerClient;
        authUserId = data.user.id;
        authUserEmail = data.user.email ?? null;
      }
    }

    if (!supabase || !authUserId) {
      const unauthorized = NextResponse.json(
        { ok: false, error: { message: "Missing access token.", code: "unauthorized" } },
        { status: 401 },
      );
      return applyResponseCookies(cookieAuth.response, unauthorized);
    }

    const url = new URL(request.url);
    if (url.searchParams.get("debugAuth") === "1") {
      const debugEnabled = process.env.NODE_ENV !== "production" && process.env.ENABLE_DEBUG_AUTH === "1";
      if (!debugEnabled) {
        return applyResponseCookies(
          cookieAuthResponse,
          NextResponse.json({ ok: false, error: { message: "Not found." } }, { status: 404 }),
        );
      }

      const { data: debugAuthContext, error: debugAuthError } = await supabase.rpc("debug_auth_context");
      if (debugAuthError) {
        throw new Error(`Failed to debug auth context: ${debugAuthError.message}`);
      }
      const debugResponse = NextResponse.json({ ok: true, data: debugAuthContext }, { status: 200 });
      return applyResponseCookies(cookieAuthResponse, debugResponse);
    }

    const context = await getCurrentUserTenantContext(supabase);

    const { data: profileData } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    let tenant: MeResponseData["tenant"] = null;
    let employee: MeResponseData["employee"] = null;
    const permissions = new Set<string>();

    if (context) {
      const [{ data: tenantData }, { data: employeeRow, error: employeeError }] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, slug")
          .eq("id", context.companyId)
          .maybeSingle(),
        supabase
          .from("employees")
          .select("id, first_name, last_name, email")
          .eq("tenant_id", context.companyId)
          .eq("user_id", authUserId)
          .maybeSingle(),
      ]);

      tenant = {
        id: context.companyId,
        name: tenantData?.name ?? null,
        slug: tenantData?.slug ?? null,
      };

      employee =
        employeeError && employeeError.message.includes("schema cache")
          ? null
          : employeeRow
            ? {
                id: employeeRow.id,
                first_name: employeeRow.first_name,
                last_name: employeeRow.last_name,
                email: employeeRow.email,
              }
            : null;

      for (const permission of permissionSetFromRole(context.role)) {
        permissions.add(permission);
      }

      if (employee) {
        const { data: permissionRows, error: permissionError } = await supabase.rpc("my_employee_permissions");

        if (!permissionError && Array.isArray(permissionRows)) {
          for (const row of permissionRows as Array<{ permission_key?: unknown }>) {
            if (typeof row?.permission_key === "string" && row.permission_key.length > 0) {
              permissions.add(row.permission_key);
            }
          }
        }
      }
    }

    const nameParts = [profileData?.first_name ?? null, profileData?.last_name ?? null]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .trim();

    const payload: MeResponseData = {
      user: {
        id: authUserId,
        email: authUserEmail,
        name: nameParts.length > 0 ? nameParts : null,
      },
      tenant,
      permissions: Array.from(permissions),
      employee,
    };

    const response = NextResponse.json({ ok: true, data: payload }, { status: 200 });
    return applyResponseCookies(cookieAuthResponse, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load current user.";
    const status = message.includes("Missing access token") ? 401 : 400;
    const response = NextResponse.json(
      { ok: false, error: { message, code: status === 401 ? "unauthorized" : "bad_request" } },
      { status },
    );
    return applyResponseCookies(cookieAuthResponse, response);
  }
}
