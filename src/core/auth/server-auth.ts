import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { TypedSupabaseClient } from "../db/supabase";
import { createSupabaseServerClient } from "./supabase-server-client";

export interface CookieAuthResult {
  supabase: TypedSupabaseClient | null;
  user: User | null;
  response?: NextResponse;
}

async function requestFromCurrentCookies(): Promise<Request> {
  const cookieStore = await cookies();
  const serialized = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  return new Request("http://localhost/_cookie-auth", {
    headers: serialized ? { cookie: serialized } : {},
  });
}

export async function getAuthenticatedUserFromCookies(
  request?: Request,
  response?: NextResponse,
): Promise<CookieAuthResult> {
  const authRequest = request ?? (await requestFromCurrentCookies());
  const authResponse = response ?? NextResponse.next();
  const supabase = createSupabaseServerClient(authRequest, authResponse);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase: null, user: null, response: authResponse };
  }

  return { supabase, user, response: authResponse };
}
