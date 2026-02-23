import { validateEnv } from "../../config/env";

function pass(message: string) {
  console.log(`PASS: ${message}`);
}

function fail(message: string): never {
  throw new Error(`FAIL: ${message}`);
}

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    fail("Current process is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const valid = validateEnv({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  });
  if (!valid.NEXT_PUBLIC_SUPABASE_URL || !valid.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    fail("Valid env parse did not return expected values.");
  }
  pass("Valid environment parses successfully.");

  expectThrows(
    "Invalid URL should fail-fast",
    () =>
      validateEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    "NEXT_PUBLIC_SUPABASE_URL",
  );

  expectThrows(
    "Missing anon key should fail-fast",
    () =>
      validateEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.com",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      }),
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

main();
