import { authenticateApiRequest } from "../../auth/api-auth";
import { fail, pass } from "./test-helpers";

async function main() {
  const cookieRequest = new Request("http://127.0.0.1/api/employees", { method: "GET" });
  const cookieResult = await authenticateApiRequest(cookieRequest, {
    createClientWithAccessToken: (() => {
      throw new Error("bearer path should not run");
    }) as any,
    resolveCookieAuth: async () =>
      ({
        supabase: { rpc: async () => ({ data: true, error: null }) } as any,
        user: { id: "cookie-user" },
      }) as any,
  });

  if (cookieResult.authUserId !== "cookie-user") {
    fail("Cookie auth path should return cookie user id.");
  }
  pass("authenticateApiRequest supports cookie auth when Authorization is missing.");

  let unauthorized = false;
  try {
    await authenticateApiRequest(new Request("http://127.0.0.1/api/employees", { method: "GET" }), {
      createClientWithAccessToken: (() => {
        throw new Error("bearer path should not run");
      }) as any,
      resolveCookieAuth: async () => ({ supabase: null, user: null }),
    });
  } catch (error) {
    unauthorized = error instanceof Error && error.message.includes("Unauthorized");
  }

  if (!unauthorized) {
    fail("authenticateApiRequest should throw unauthorized when bearer and cookie auth are missing.");
  }
  pass("authenticateApiRequest rejects unauthenticated requests.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
