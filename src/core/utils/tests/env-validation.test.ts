/**
 * Local test setup:
 * 1. Copy `.env.test.local.example` -> `.env.test.local`
 * 2. Fill dummy accounts for TENANT_A/B and EDGE_CASE
 * 3. Run all tests: npm run test:workflow
 * 4. Check console output for pass/fail
 */
import { validateEnv } from "../../config/env";
import { fail, pass, requireEnv } from "./test-helpers";

function expectThrows(label: string, fn: () => void, expectedText: string) {
  try {
    fn();
    fail(`${label}: expected error was not thrown.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedText)) {
      fail(`${label}: expected "${expectedText}" in error, got "${message}"`);
    }
    pass(label);
  }
}

function main() {
  const url = process.env.SUPABASE_URL ?? requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const valid = validateEnv({
    SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  });
  if (!valid.NEXT_PUBLIC_SUPABASE_URL || !valid.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    fail("Valid env parse did not return expected values.");
  }
  pass("Valid environment parses successfully.");

  expectThrows(
    "Placeholder URL should fail-fast",
    () =>
      validateEnv({
        SUPABASE_URL: "https://your-project-id.supabase.co",
        NEXT_PUBLIC_SUPABASE_URL: "https://your-project-id.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    "SUPABASE_URL is a placeholder or invalid",
  );

  expectThrows(
    "Non-Supabase URL should fail-fast",
    () =>
      validateEnv({
        SUPABASE_URL: "https://example.com",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.com",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    "SUPABASE_URL is a placeholder or invalid",
  );

  expectThrows(
    "Missing SUPABASE_URL should fail-fast",
    () =>
      validateEnv({
        SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    "SUPABASE_URL is not set",
  );

  expectThrows(
    "Missing anon key should fail-fast",
    () =>
      validateEnv({
        SUPABASE_URL: "https://ocdaibqbmvppzrdeneqh.supabase.co",
        NEXT_PUBLIC_SUPABASE_URL: "https://ocdaibqbmvppzrdeneqh.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      }),
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

main();
