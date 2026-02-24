import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../../../../core/auth/manage-permissions";
import { applyResponseCookies } from "../../../../../../core/auth/supabase-server-client";
import { getActiveCompanyId } from "../../../../../../core/tenancy/get-active-company";

function isMarketplaceEnabled(): boolean {
  return process.env.ENABLE_MARKETPLACE === "1";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let authResponse: NextResponse | undefined;
  try {
    if (!isMarketplaceEnabled()) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    await requireManagePermissions(auth.supabase);
    const activeCompanyId = await getActiveCompanyId(auth.supabase);
    const { id } = await params;

    const { data, error } = await auth.supabase
      .from("marketplace_assignments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", activeCompanyId)
      .select("id, post_id, worker_user_id, company_id, starts_at, ends_at, status, created_at, completed_at")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to complete marketplace assignment: ${error.message}`);
    }
    if (!data) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: "Marketplace assignment not found." }, { status: 404 }),
      );
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(
      authResponse,
      toApiErrorResponse(error, "Failed to complete marketplace assignment."),
    );
  }
}
