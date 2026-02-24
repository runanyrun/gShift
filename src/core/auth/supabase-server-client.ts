import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { env } from "../config/env";
import type { Database } from "../db/database.types";
import type { TypedSupabaseClient } from "../db/supabase";

type CookiePair = { name: string; value: string };

function parseCookieHeader(cookieHeader: string | null): CookiePair[] {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq <= 0) {
        return null;
      }

      return {
        name: part.slice(0, eq).trim(),
        value: part.slice(eq + 1).trim(),
      };
    })
    .filter((entry): entry is CookiePair => Boolean(entry));
}

function readRequestCookies(request: Request): CookiePair[] {
  if (request instanceof NextRequest) {
    return request.cookies.getAll().map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
    }));
  }

  const withCookies = request as Request & {
    cookies?: { getAll?: () => Array<{ name: string; value: string }> };
  };

  if (withCookies.cookies?.getAll) {
    return withCookies.cookies.getAll().map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
    }));
  }

  return parseCookieHeader(request.headers.get("cookie"));
}

function writeResponseCookie(
  response: NextResponse,
  name: string,
  value: string,
  options?: CookieOptions,
) {
  response.cookies.set(name, value, options);
}

export function createSupabaseServerClient(
  request: Request,
  response: NextResponse,
): TypedSupabaseClient {
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => readRequestCookies(request),
      setAll: (cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) => {
        for (const cookie of cookiesToSet) {
          writeResponseCookie(response, cookie.name, cookie.value, cookie.options);
        }
      },
    },
  }) as unknown as TypedSupabaseClient;
}

export function applyResponseCookies(
  source: NextResponse | undefined,
  target: NextResponse,
): NextResponse {
  if (!source) {
    return target;
  }

  const headersWithGetSetCookie = source.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookiesFromHeaders = headersWithGetSetCookie.getSetCookie?.() ?? [];

  if (setCookiesFromHeaders.length > 0) {
    for (const setCookie of setCookiesFromHeaders) {
      target.headers.append("set-cookie", setCookie);
    }
    return target;
  }

  const rawSetCookie = source.headers.get("set-cookie");
  if (rawSetCookie) {
    const splitCookies = rawSetCookie.split(/,(?=[^;,]+=)/g).map((value) => value.trim());
    for (const setCookie of splitCookies) {
      if (setCookie.length > 0) {
        target.headers.append("set-cookie", setCookie);
      }
    }
    return target;
  }

  const buffer = NextResponse.next();
  for (const cookie of source.cookies.getAll()) {
    const { name, value, ...options } = cookie;
    buffer.cookies.set(name, value, options);
  }

  const bufferHeaders = buffer.headers as Headers & { getSetCookie?: () => string[] };
  const bufferSetCookies = bufferHeaders.getSetCookie?.() ?? [];
  if (bufferSetCookies.length > 0) {
    for (const setCookie of bufferSetCookies) {
      target.headers.append("set-cookie", setCookie);
    }
    return target;
  }

  const rawBufferSetCookie = buffer.headers.get("set-cookie");
  if (rawBufferSetCookie) {
    for (const setCookie of rawBufferSetCookie.split(/,(?=[^;,]+=)/g)) {
      const trimmed = setCookie.trim();
      if (trimmed.length > 0) {
        target.headers.append("set-cookie", trimmed);
      }
    }
  }

  return target;
}
