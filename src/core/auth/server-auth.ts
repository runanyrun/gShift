import { cookies } from "next/headers";
import { createSupabaseClientWithAccessToken, TypedSupabaseClient } from "../db/supabase";

function looksLikeJwt(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function tryDecodeCookieValue(rawValue: string): string {
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function extractAccessTokenFromValue(rawValue: string): string | null {
  const decoded = tryDecodeCookieValue(rawValue).trim();
  if (!decoded) {
    return null;
  }

  if (looksLikeJwt(decoded)) {
    return decoded;
  }

  try {
    const parsed = JSON.parse(decoded) as unknown;

    if (typeof parsed === "string") {
      return looksLikeJwt(parsed) ? parsed : null;
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string" && looksLikeJwt(item)) {
          return item;
        }
        if (item && typeof item === "object" && "access_token" in item) {
          const token = (item as { access_token?: unknown }).access_token;
          if (typeof token === "string" && looksLikeJwt(token)) {
            return token;
          }
        }
      }
      return null;
    }

    if (parsed && typeof parsed === "object" && "access_token" in parsed) {
      const token = (parsed as { access_token?: unknown }).access_token;
      if (typeof token === "string" && looksLikeJwt(token)) {
        return token;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getChunkedCookieValue(cookiePairs: Array<{ name: string; value: string }>, baseName: string): string | null {
  const exact = cookiePairs.find((item) => item.name === baseName);
  if (exact) {
    return exact.value;
  }

  const chunks = cookiePairs
    .map((item) => {
      const match = item.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(\\d+)$`));
      if (!match) {
        return null;
      }
      return { idx: Number.parseInt(match[1], 10), value: item.value };
    })
    .filter((item): item is { idx: number; value: string } => Boolean(item))
    .sort((a, b) => a.idx - b.idx);

  if (chunks.length === 0) {
    return null;
  }

  return chunks.map((chunk) => chunk.value).join("");
}

function extractAccessTokenFromCookies(cookiePairs: Array<{ name: string; value: string }>): string | null {
  const candidateBaseNames = [
    ...new Set(
      cookiePairs
        .map((item) => item.name)
        .filter((name) => name.startsWith("sb-") && name.includes("-auth-token"))
        .map((name) => name.replace(/\.\d+$/, "")),
    ),
  ];

  for (const baseName of candidateBaseNames) {
    const joinedValue = getChunkedCookieValue(cookiePairs, baseName);
    if (!joinedValue) {
      continue;
    }

    const token = extractAccessTokenFromValue(joinedValue);
    if (token) {
      return token;
    }
  }

  for (const { value } of cookiePairs) {
    const token = extractAccessTokenFromValue(value);
    if (token) {
      return token;
    }
  }

  return null;
}

export async function createServerClientFromCookies(): Promise<TypedSupabaseClient | null> {
  const cookieStore = await cookies();
  const token = extractAccessTokenFromCookies(cookieStore.getAll());
  if (!token) {
    return null;
  }

  return createSupabaseClientWithAccessToken(token);
}

export async function getAuthenticatedUserFromCookies() {
  const supabase = await createServerClientFromCookies();
  if (!supabase) {
    return { supabase: null, user: null };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase: null, user: null };
  }

  return { supabase, user: data.user };
}
