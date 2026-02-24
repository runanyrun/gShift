import { requireManagePermissions } from "../../auth/manage-permissions";
import { fail, pass } from "./test-helpers";

async function main() {
  await requireManagePermissions({
    rpc: async () => ({ data: true, error: null }),
  } as any);
  pass("requireManagePermissions allows management users.");

  let denied = false;
  try {
    await requireManagePermissions({
      rpc: async () => ({ data: false, error: null }),
    } as any);
  } catch (error) {
    denied = error instanceof Error && error.message === "no-permission";
  }
  if (!denied) {
    fail("requireManagePermissions should reject non-management users with no-permission.");
  }
  pass("requireManagePermissions rejects non-management users.");

  let rpcError = false;
  try {
    await requireManagePermissions({
      rpc: async () => ({ data: null, error: { message: "rpc failed" } }),
    } as any);
  } catch (error) {
    rpcError = error instanceof Error && error.message.includes("rpc failed");
  }
  if (!rpcError) {
    fail("requireManagePermissions should propagate rpc validation errors.");
  }
  pass("requireManagePermissions surfaces rpc errors.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
