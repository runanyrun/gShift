import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../../../../core/auth/manage-permissions";
import { applyResponseCookies } from "../../../../../../core/auth/supabase-server-client";
import { getActiveCompanyId } from "../../../../../../core/tenancy/get-active-company";

function isMarketplaceEnabled(): boolean {
  return process.env.ENABLE_MARKETPLACE === "1";
}

interface AcceptBody {
  workerUserId?: string;
  applicationId?: string;
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
    const body = (await request.json().catch(() => ({}))) as AcceptBody;

    const { data: post, error: postError } = await auth.supabase
      .from("marketplace_job_posts")
      .select("id, company_id, starts_at, ends_at, status")
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

    const { data: existingAssignment, error: existingAssignmentError } = await auth.supabase
      .from("marketplace_assignments")
      .select("id, post_id, worker_user_id, company_id, starts_at, ends_at, status, created_at, completed_at")
      .eq("post_id", id)
      .maybeSingle();
    if (existingAssignmentError) {
      throw new Error(`Failed to load marketplace assignment: ${existingAssignmentError.message}`);
    }
    if (existingAssignment) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: true, data: existingAssignment }, { status: 200 }),
      );
    }

    if (post.status !== "open") {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: "post-not-open" }, { status: 409 }),
      );
    }

    let applicationQuery = auth.supabase
      .from("marketplace_applications")
      .select("id, worker_user_id, status")
      .eq("post_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (body.applicationId) {
      applicationQuery = auth.supabase
        .from("marketplace_applications")
        .select("id, worker_user_id, status")
        .eq("id", body.applicationId)
        .eq("post_id", id)
        .limit(1);
    } else if (body.workerUserId) {
      applicationQuery = auth.supabase
        .from("marketplace_applications")
        .select("id, worker_user_id, status")
        .eq("post_id", id)
        .eq("worker_user_id", body.workerUserId)
        .order("created_at", { ascending: false })
        .limit(1);
    }

    const { data: applicationRows, error: applicationError } = await applicationQuery;
    if (applicationError) {
      throw new Error(`Failed to load marketplace application: ${applicationError.message}`);
    }
    const application = applicationRows?.[0];
    if (!application) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: "Marketplace application not found." }, { status: 404 }),
      );
    }

    const { data: overlap, error: overlapError } = await auth.supabase
      .from("marketplace_assignments")
      .select("id")
      .eq("worker_user_id", application.worker_user_id)
      .eq("status", "active")
      .lt("starts_at", post.ends_at)
      .gt("ends_at", post.starts_at)
      .limit(1);
    if (overlapError) {
      throw new Error(`Failed to validate worker time conflict: ${overlapError.message}`);
    }
    if ((overlap ?? []).length > 0) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: "time-conflict" }, { status: 409 }),
      );
    }

    const { data: createdAssignment, error: createAssignmentError } = await auth.supabase
      .from("marketplace_assignments")
      .insert({
        post_id: id,
        worker_user_id: application.worker_user_id,
        company_id: activeCompanyId,
        starts_at: post.starts_at,
        ends_at: post.ends_at,
        status: "active",
      })
      .select("id, post_id, worker_user_id, company_id, starts_at, ends_at, status, created_at, completed_at")
      .maybeSingle();

    if (createAssignmentError) {
      const isPostAlreadyAssigned =
        createAssignmentError.code === "23505" ||
        createAssignmentError.message.toLowerCase().includes("marketplace_assignments_post_uq");
      if (isPostAlreadyAssigned) {
        const { data: alreadyCreated, error: alreadyCreatedError } = await auth.supabase
          .from("marketplace_assignments")
          .select("id, post_id, worker_user_id, company_id, starts_at, ends_at, status, created_at, completed_at")
          .eq("post_id", id)
          .maybeSingle();
        if (alreadyCreatedError) {
          throw new Error(`Failed to load existing assignment: ${alreadyCreatedError.message}`);
        }
        return applyResponseCookies(
          authResponse,
          NextResponse.json({ ok: true, data: alreadyCreated }, { status: 200 }),
        );
      }
      throw new Error(`Failed to create marketplace assignment: ${createAssignmentError.message}`);
    }

    const { error: updatePostError } = await auth.supabase
      .from("marketplace_job_posts")
      .update({ status: "assigned" })
      .eq("id", id);
    if (updatePostError) {
      throw new Error(`Failed to update marketplace post status: ${updatePostError.message}`);
    }

    const { error: updateApplicationError } = await auth.supabase
      .from("marketplace_applications")
      .update({ status: "accepted" })
      .eq("id", application.id);
    if (updateApplicationError) {
      throw new Error(`Failed to update marketplace application status: ${updateApplicationError.message}`);
    }

    return applyResponseCookies(
      authResponse,
      NextResponse.json({ ok: true, data: createdAssignment }, { status: 201 }),
    );
  } catch (error) {
    return applyResponseCookies(
      authResponse,
      toApiErrorResponse(error, "Failed to accept marketplace application."),
    );
  }
}
