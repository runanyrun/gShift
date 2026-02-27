import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../../core/auth/manage-permissions";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";

const createJobSchema = z.object({
  location_id: z.string().uuid(),
  role_id: z.string().uuid(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  hourly_rate: z.coerce.number().min(0),
  currency: z.string().trim().min(3).max(3).optional(),
  notes: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(140).optional(),
});

const updateJobSchema = z.object({
  id: z.string().uuid(),
  patch: z
    .object({
      location_id: z.string().uuid().optional(),
      role_id: z.string().uuid().optional(),
      start_at: z.string().datetime().optional(),
      end_at: z.string().datetime().optional(),
      hourly_rate: z.coerce.number().min(0).optional(),
      currency: z.string().trim().min(3).max(3).optional(),
      notes: z.string().optional().nullable(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one patch field is required.",
    }),
});

const listQuerySchema = z.object({
  status: z.string().optional(),
  locationId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    await requireManagePermissions(auth.supabase);

    const parsed = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const { data, error } = await auth.supabase.rpc("list_jobs" as never, {
      p_status: parsed.status ?? null,
      p_location_id: parsed.locationId ?? null,
      p_from: parsed.from ?? null,
      p_to: parsed.to ?? null,
      p_limit: parsed.limit ?? 50,
      p_offset: parsed.offset ?? 0,
    } as never);

    if (error) {
      throw new Error(`Failed to list manager jobs: ${error.message}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: data ?? [] }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to list manager jobs."));
  }
}

export async function POST(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    await requireManagePermissions(auth.supabase);

    const payload = createJobSchema.parse(await request.json());
    const { data, error } = await auth.supabase.rpc("create_job" as never, {
      p_location_id: payload.location_id,
      p_role_id: payload.role_id,
      p_start_at: payload.start_at,
      p_end_at: payload.end_at,
      p_hourly_rate: payload.hourly_rate,
      p_currency: payload.currency ?? "USD",
      p_notes: payload.notes ?? null,
      p_title: payload.title ?? null,
    } as never);

    if (error) {
      throw new Error(`Failed to create manager job: ${error.message}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 201 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to create manager job."));
  }
}

export async function PATCH(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    await requireManagePermissions(auth.supabase);

    const payload = updateJobSchema.parse(await request.json());
    const patch = payload.patch;

    const { data, error } = await auth.supabase.rpc("update_job" as never, {
      p_job_id: payload.id,
      p_location_id: patch.location_id ?? null,
      p_role_id: patch.role_id ?? null,
      p_start_at: patch.start_at ?? null,
      p_end_at: patch.end_at ?? null,
      p_hourly_rate: patch.hourly_rate ?? null,
      p_currency: patch.currency ?? null,
      p_notes: patch.notes ?? null,
    } as never);

    if (error) {
      throw new Error(`Failed to update manager job: ${error.message}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to update manager job."));
  }
}
