import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const params = paramsSchema.parse(await context.params);

    const { data, error } = await auth.supabase.rpc("get_open_job_for_worker" as never, {
      p_job_id: params.id,
    } as never);

    if (error) {
      throw new Error(`Failed to load job detail: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return applyResponseCookies(authResponse, NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 }));
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: row }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to load job detail."));
  }
}
