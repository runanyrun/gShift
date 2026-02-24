/**
 * Env-dependent test.
 * Requires MULTI_COMPANY_ACCESS_TOKEN for a pre-arranged anomalous account.
 * Run: npm run test:env-dependent
 */
import { createSupabaseClientWithAccessToken } from "../../../db/supabase";
import { fail, pass } from "../test-helpers";

async function main() {
  const token = process.env.MULTI_COMPANY_ACCESS_TOKEN;
  if (!token) {
    console.log("SKIP: MULTI_COMPANY_ACCESS_TOKEN not set.");
    process.exit(0);
  }

  const client = createSupabaseClientWithAccessToken(token);
  const { error } = await client.rpc("current_user_company_id");
  if (!error || !error.message.includes("Multiple companies found")) {
    fail(
      `Expected multiple-company exception, got: ${error?.message ?? "no error returned"}`,
    );
  }
  pass("Multiple companies for same user throws exception.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
