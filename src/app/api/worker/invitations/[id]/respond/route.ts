import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../../../core/auth/supabase-server-client";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  decision: z.enum(["accept", "reject"]),
  note: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const params = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json());

    const { data, error } = await auth.supabase.rpc("respond_invite" as never, {
      p_invite_id: params.id,
      p_decision: body.decision,
      p_note: body.note ?? null,
    } as never);
    if (error) {
      throw new Error(`Failed to respond invite: ${error.message}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to respond invite."));
  }
}
