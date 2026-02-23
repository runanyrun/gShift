import { z } from "zod";
import { resolveSupabaseUrl } from "../env/validate-supabase";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}): AppEnv {
  const validatedSupabaseUrl = resolveSupabaseUrl({
    SUPABASE_URL: rawEnv.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: rawEnv.NEXT_PUBLIC_SUPABASE_URL,
  });

  const resolvedAnonKey = rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? rawEnv.SUPABASE_ANON_KEY;

  const envParseResult = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: validatedSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolvedAnonKey,
  });

  if (!envParseResult.success) {
    const issues = envParseResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Environment validation failed: ${issues}`);
  }

  return envParseResult.data;
}

export const env = validateEnv({
  SUPABASE_URL: process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
