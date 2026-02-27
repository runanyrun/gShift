import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../../core/auth/supabase-server-client";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const params = paramsSchema.parse(await context.params);

    const { data, error } = await auth.supabase.rpc("mark_notification_read" as never, {
      p_notification_id: params.id,
    } as never);
    if (error) {
      throw new Error(`Failed to mark notification read: ${error.message}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to mark notification read."));
  }
}
