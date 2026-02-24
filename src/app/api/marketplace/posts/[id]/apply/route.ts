import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../../../core/auth/supabase-server-client";

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
    const { id } = await params;
    const { data: post, error: postError } = await auth.supabase
      .from("marketplace_job_posts")
      .select("id, status")
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
    if (post.status !== "open") {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: "Marketplace post is not open." }, { status: 409 }),
      );
    }

    const { data, error } = await auth.supabase
      .from("marketplace_applications")
      .insert({
        post_id: id,
        worker_user_id: auth.authUserId,
        status: "submitted",
      })
      .select("id, post_id, worker_user_id, status, created_at")
      .maybeSingle();

    if (error) {
      const details = (error.details ?? "").toLowerCase();
      const hint = (error.hint ?? "").toLowerCase();
      const message = error.message.toLowerCase();
      const isUniqueConflict =
        error.code === "23505" ||
        message.includes("duplicate key") ||
        message.includes("marketplace_applications_post_worker_uq") ||
        details.includes("marketplace_applications_post_worker_uq") ||
        hint.includes("marketplace_applications_post_worker_uq");
      if (isUniqueConflict) {
        return applyResponseCookies(
          authResponse,
          NextResponse.json(
            { ok: true, data: { postId: id, alreadyApplied: true, status: "submitted" } },
            { status: 200 },
          ),
        );
      }
      throw new Error(`Failed to apply for marketplace post: ${error.message}`);
    }

    const created = data ?? null;
    if (!created) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json(
          { ok: true, data: { postId: id, alreadyApplied: true, status: "submitted" } },
          { status: 200 },
        ),
      );
    }

    return applyResponseCookies(
      authResponse,
      NextResponse.json(
        {
          ok: true,
          data: {
            id: created.id,
            postId: created.post_id,
            workerUserId: created.worker_user_id,
            status: created.status,
            createdAt: created.created_at,
          },
        },
        { status: 201 },
      ),
    );
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to apply for marketplace post."));
  }
}
