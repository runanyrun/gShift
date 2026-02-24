import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../../../core/auth/manage-permissions";
import { applyResponseCookies } from "../../../../../core/auth/supabase-server-client";
import { getActiveCompanyId } from "../../../../../core/tenancy/get-active-company";

function isMarketplaceEnabled(): boolean {
  return process.env.ENABLE_MARKETPLACE === "1";
}

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    if (!isMarketplaceEnabled()) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    await requireManagePermissions(auth.supabase);
    const companyId = await getActiveCompanyId(auth.supabase);

    const { data, error } = await auth.supabase
      .from("marketplace_job_posts")
      .select("id, company_id, title, starts_at, ends_at, location_id, pay_rate, status, created_at")
      .eq("company_id", companyId)
      .in("status", ["open", "assigned"])
      .order("starts_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to load management marketplace posts: ${error.message}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: data ?? [] }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(
      authResponse,
      toApiErrorResponse(error, "Failed to load management marketplace posts."),
    );
  }
}
