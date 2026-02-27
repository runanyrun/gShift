import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../core/auth/supabase-server-client";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().datetime().optional(),
  unread_only: z
    .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional(),
});

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const parsed = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const unreadOnly = parsed.unread_only === "true" || parsed.unread_only === "1";

    const withUnreadOnly = await auth.supabase.rpc("list_notifications" as never, {
      p_limit: parsed.limit ?? 20,
      p_cursor: parsed.cursor ?? null,
      p_unread_only: unreadOnly,
    } as never);
    let data = withUnreadOnly.data;
    if (withUnreadOnly.error) {
      const fallback = await auth.supabase.rpc("list_notifications" as never, {
        p_limit: parsed.limit ?? 20,
        p_cursor: parsed.cursor ?? null,
      } as never);
      if (fallback.error) {
        throw new Error(`Failed to list notifications: ${fallback.error.message}`);
      }
      data = fallback.data;
    }

    const payload = (data ?? { items: [], unread_count: 0 }) as { items: unknown[]; unread_count: number };
    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: payload }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to list notifications."));
  }
}
