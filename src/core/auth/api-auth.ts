import { createSupabaseClientWithAccessToken, TypedSupabaseClient } from "../db/supabase";
import { getAuthenticatedUserFromCookies } from "./server-auth";
import { NextResponse } from "next/server";

export interface ApiAuthContext {
  supabase: TypedSupabaseClient;
  authUserId: string;
  response?: NextResponse;
}

export interface ApiAuthDependencies {
  createClientWithAccessToken: (accessToken: string) => TypedSupabaseClient;
  resolveCookieAuth: (request: Request) => Promise<{
    supabase: TypedSupabaseClient | null;
    user: { id: string } | null;
    response?: NextResponse;
  }>;
}

const defaultDependencies: ApiAuthDependencies = {
  createClientWithAccessToken: createSupabaseClientWithAccessToken,
  resolveCookieAuth: getAuthenticatedUserFromCookies,
};

export async function authenticateApiRequest(
  request: Request,
  deps: ApiAuthDependencies = defaultDependencies,
): Promise<ApiAuthContext> {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (accessToken) {
    const supabase = deps.createClientWithAccessToken(accessToken);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error("Invalid or expired access token.");
    }

    return {
      supabase,
      authUserId: data.user.id,
    };
  }

  const cookieAuth = await deps.resolveCookieAuth(request);
  if (cookieAuth.supabase && cookieAuth.user) {
    return {
      supabase: cookieAuth.supabase,
      authUserId: cookieAuth.user.id,
      response: cookieAuth.response,
    };
  }

  throw new Error("Unauthorized");
}
