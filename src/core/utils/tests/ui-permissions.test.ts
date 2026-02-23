/**
 * Local test setup:
 * 1. Run: npm run test:ui-permissions
 */
import { canManage, hasPerm } from "../../auth/permissions";
import { fail, pass } from "./test-helpers";

function main() {
  if (!hasPerm(["management"], "management")) {
    fail("hasPerm should return true for existing permission.");
  }
  if (hasPerm(["management"], "administration")) {
    fail("hasPerm should return false for missing permission.");
  }
  if (!canManage(["administration"])) {
    fail("canManage should allow administration.");
  }
  if (!canManage(["management"])) {
    fail("canManage should allow management.");
  }
  if (canManage(["report_management"])) {
    fail("canManage should reject non-management permissions.");
  }
  pass("Permission helper logic is correct.");
}

main();
