import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../../../../core/auth/manage-permissions";
import { applyResponseCookies } from "../../../../../../core/auth/supabase-server-client";
import { getActiveCompanyId } from "../../../../../../core/tenancy/get-active-company";

function isMarketplaceEnabled(): boolean {
  return process.env.ENABLE_MARKETPLACE === "1";
}

export async function GET(
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
    const { data: post, error: postError } = await auth.supabase
      .from("marketplace_job_posts")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();

    if (postError) {
      throw new Error(`Failed to load marketplace post: ${postError.message}`);
    }
    if (!post) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: "Marketplace post not found." }, { status: 404 }),
      );
    }
    if (post.company_id !== activeCompanyId) {
      throw new Error("no-permission");
    }

    const { data, error } = await auth.supabase
      .from("marketplace_applications")
      .select("id, worker_user_id, status, created_at")
      .eq("post_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load marketplace applications: ${error.message}`);
    }

    const applications = (data ?? []).map((row: { id: string; worker_user_id: string; status: string; created_at: string }) => ({
      applicationId: row.id,
      workerUserId: row.worker_user_id,
      status: row.status,
      createdAt: row.created_at,
    }));

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: applications }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(
      authResponse,
      toApiErrorResponse(error, "Failed to list marketplace applications."),
    );
  }
}
