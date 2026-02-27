import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../../../../core/auth/manage-permissions";
import { applyResponseCookies } from "../../../../../../core/auth/supabase-server-client";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  worker_id: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    await requireManagePermissions(auth.supabase);

    const params = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    const { data, error } = await auth.supabase.rpc("reject_applicant" as never, {
      p_job_id: params.id,
      p_worker_id: body.worker_id,
      p_reason: body.reason ?? null,
    } as never);
    if (error) {
      throw new Error(`Failed to reject applicant: ${error.message}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to reject applicant."));
  }
}
