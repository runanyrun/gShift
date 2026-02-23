import { NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../core/auth/api-auth";
import { getCurrentUserTenantContext } from "../../../core/auth/current-user";
import { MeResponseData } from "../../../core/auth/me.types";

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
export async function GET(request: Request) {
  try {
    const { supabase, authUserId } = await authenticateApiRequest(request);
    const context = await getCurrentUserTenantContext(supabase);

    const [{ data: authUserData }, { data: profileData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("users")
        .select("first_name, last_name")
        .eq("auth_user_id", authUserId)
        .maybeSingle(),
    ]);

    let tenant: MeResponseData["tenant"] = null;
    let employee: MeResponseData["employee"] = null;
    const permissions = new Set<string>();

    if (context) {
      const [{ data: tenantData }, { data: employeeRow, error: employeeError }] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name")
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
        const { data: permissionRows, error: permissionError } = await supabase
          .from("employee_permissions")
          .select("permission_key")
          .eq("tenant_id", context.companyId)
          .eq("employee_id", employee.id);

        if (!permissionError) {
          for (const row of permissionRows) {
            permissions.add(row.permission_key);
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
        email: authUserData.user?.email ?? null,
        name: nameParts.length > 0 ? nameParts : null,
      },
      tenant,
      permissions: Array.from(permissions),
      employee,
    };

    return NextResponse.json({ ok: true, data: payload }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load current user.";
    const status =
      message.includes("Missing access token") ||
      message.includes("Invalid or expired access token")
        ? 401
        : 400;
    return NextResponse.json(
      { ok: false, error: { message, code: status === 401 ? "unauthorized" : "bad_request" } },
      { status },
    );
  }
}
