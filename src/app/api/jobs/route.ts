import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../core/auth/supabase-server-client";

const querySchema = z.object({
  search: z.string().optional(),
  locationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const parsed = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

    const { data, error } = await auth.supabase.rpc("list_open_jobs_for_worker" as never, {
      p_search: parsed.search ?? null,
      p_location_id: parsed.locationId ?? null,
      p_limit: parsed.limit ?? 50,
      p_offset: parsed.offset ?? 0,
    } as never);

    if (error) {
      throw new Error(`Failed to list open jobs: ${error.message}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: data ?? [] }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to list open jobs."));
  }
}
