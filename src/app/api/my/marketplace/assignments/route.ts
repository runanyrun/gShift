import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../../core/auth/supabase-server-client";

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
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "active";

    let query = auth.supabase
      .from("marketplace_assignments")
      .select("id, post_id, worker_user_id, company_id, starts_at, ends_at, status, created_at, completed_at")
      .eq("worker_user_id", auth.authUserId)
      .order("starts_at", { ascending: true });

    if (status === "active") {
      query = query.eq("status", "active");
    } else if (status === "completed") {
      query = query.eq("status", "completed");
    }

    const { data: assignments, error: assignmentsError } = await query;
    if (assignmentsError) {
      throw new Error(`Failed to load my marketplace assignments: ${assignmentsError.message}`);
    }

    const postIds = Array.from(new Set((assignments ?? []).map((row) => row.post_id)));
    const { data: posts, error: postsError } =
      postIds.length > 0
        ? await auth.supabase
            .from("marketplace_job_posts")
            .select("id, title")
            .in("id", postIds)
        : { data: [], error: null };
    if (postsError) {
      throw new Error(`Failed to load marketplace posts for assignments: ${postsError.message}`);
    }
    const postMap = new Map((posts ?? []).map((row) => [row.id, row.title]));

    const rows = (assignments ?? []).map((row) => ({
      id: row.id,
      postId: row.post_id,
      workerUserId: row.worker_user_id,
      companyId: row.company_id,
      title: postMap.get(row.post_id) ?? null,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: rows }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(
      authResponse,
      toApiErrorResponse(error, "Failed to load my marketplace assignments."),
    );
  }
}
