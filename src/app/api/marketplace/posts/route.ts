import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../../core/auth/manage-permissions";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";
import { getActiveCompanyId } from "../../../../core/tenancy/get-active-company";

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

    const { data, error } = await auth.supabase
      .from("marketplace_job_posts")
      .select("id, company_id, title, starts_at, ends_at, location_id, pay_rate, status, created_at")
      .eq("status", "open")
      .order("starts_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to load marketplace posts: ${error.message}`);
    }

    return applyResponseCookies(
      authResponse,
      NextResponse.json(
        {
          ok: true,
          data: data ?? [],
        },
        { status: 200 },
      ),
    );
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to list marketplace posts."));
  }
}

export async function POST(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    if (!isMarketplaceEnabled()) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    await requireManagePermissions(auth.supabase);
    const companyId = await getActiveCompanyId(auth.supabase);

    const body = (await request.json()) as {
      title?: string;
      startsAt?: string;
      endsAt?: string;
      payRate?: number | null;
      locationId?: string | null;
    };
    const title = body.title?.trim();
    if (!title) {
      throw new Error("Title is required.");
    }
    if (!body.startsAt || !body.endsAt) {
      throw new Error("startsAt and endsAt are required.");
    }

    const { data, error } = await auth.supabase
      .from("marketplace_job_posts")
      .insert({
        company_id: companyId,
        title,
        starts_at: body.startsAt,
        ends_at: body.endsAt,
        location_id: body.locationId ?? null,
        pay_rate: body.payRate ?? null,
        status: "open",
      })
      .select("id, company_id, title, starts_at, ends_at, location_id, pay_rate, status, created_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create marketplace post: ${error?.message ?? "unknown error"}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 201 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to create marketplace post."));
  }
}
