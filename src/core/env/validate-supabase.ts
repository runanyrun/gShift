const CLOUD_SUPABASE_URL_PATTERN = /^https:\/\/[a-z0-9]+\.supabase\.co$/;
const LOCAL_SUPABASE_URL_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

interface SupabaseEnvInput {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
}

function isPlaceholderSupabaseUrl(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("yourproject.supabase.co") || normalized.includes("your-project-id.supabase.co");
}

function isValidSupabaseUrl(value: string): boolean {
  return CLOUD_SUPABASE_URL_PATTERN.test(value) || LOCAL_SUPABASE_URL_PATTERN.test(value);
}

export function resolveSupabaseUrl(rawEnv: SupabaseEnvInput): string {
  const value = rawEnv.SUPABASE_URL ?? rawEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!value || value.trim().length === 0) {
    throw new Error("SUPABASE_URL is not set");
  }

  const normalized = value.trim();
  if (isPlaceholderSupabaseUrl(normalized) || !isValidSupabaseUrl(normalized)) {
    throw new Error(
      "SUPABASE_URL is a placeholder or invalid. Set your real Supabase project URL (or local http://localhost:54321).",
    );
  }

  return normalized;
}

export function assertValidSupabaseEnv(rawEnv: SupabaseEnvInput): void {
  resolveSupabaseUrl(rawEnv);
}
