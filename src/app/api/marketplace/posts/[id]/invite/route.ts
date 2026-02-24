import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../../../../core/auth/manage-permissions";
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
    await requireManagePermissions(auth.supabase);
    const { id } = await params;
    const body = await request.json();

    return applyResponseCookies(
      authResponse,
      NextResponse.json(
        {
          ok: false,
          error: "Not Implemented",
          todo: {
            action: "Invite worker to marketplace post",
            postId: id,
            requestShape: {
              workerUserId: "uuid",
              note: "string|optional",
            },
            received: body,
          },
        },
        { status: 501 },
      ),
    );
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to invite worker for marketplace post."));
  }
}
