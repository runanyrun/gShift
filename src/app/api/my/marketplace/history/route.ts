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

    const { data: assignments, error: assignmentsError } = await auth.supabase
      .from("marketplace_assignments")
      .select("id, post_id, company_id, starts_at, ends_at, status, completed_at")
      .eq("worker_user_id", auth.authUserId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(50);
    if (assignmentsError) {
      throw new Error(`Failed to load marketplace history: ${assignmentsError.message}`);
    }

    const companyIds = Array.from(
      new Set((assignments ?? []).map((row: { company_id: string }) => row.company_id)),
    );
    const postIds = Array.from(
      new Set((assignments ?? []).map((row: { post_id: string }) => row.post_id)),
    );

    const [{ data: companies, error: companiesError }, { data: posts, error: postsError }] = await Promise.all([
      companyIds.length > 0
        ? auth.supabase.from("companies").select("id, name, slug").in("id", companyIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length > 0
        ? auth.supabase.from("marketplace_job_posts").select("id, title").in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (companiesError) {
      throw new Error(`Failed to load marketplace company metadata: ${companiesError.message}`);
    }
    if (postsError) {
      throw new Error(`Failed to load marketplace post metadata: ${postsError.message}`);
    }

    const companyMap = new Map(
      (companies ?? []).map((row: { id: string; name: string | null; slug: string | null }) => [row.id, row]),
    );
    const postMap = new Map(
      (posts ?? []).map((row: { id: string; title: string }) => [row.id, row]),
    );

    const rows = (assignments ?? []).map((row: {
      id: string;
      post_id: string;
      company_id: string;
      starts_at: string;
      ends_at: string;
      status: string;
      completed_at: string | null;
    }) => ({
      id: row.id,
      postId: row.post_id,
      title: postMap.get(row.post_id)?.title ?? null,
      companyId: row.company_id,
      companyName: companyMap.get(row.company_id)?.name ?? null,
      companySlug: companyMap.get(row.company_id)?.slug ?? null,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      completedAt: row.completed_at,
    }));

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: rows }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to load marketplace history."));
  }
}
