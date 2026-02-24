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
  if (!canManage(["Administration"])) {
    fail("canManage should normalize case for management keys.");
  }
  if (!hasPerm(["report-management"], "report_management")) {
    fail("hasPerm should normalize kebab-case permission keys.");
  }
  if (!hasPerm(["reportManagement"], "report_management")) {
    fail("hasPerm should normalize camelCase permission keys.");
  }
  if (!canManage({ administration: true })) {
    fail("canManage should accept object-map permission input.");
  }
  if (!hasPerm({ management: 1 }, "management")) {
    fail("hasPerm should treat truthy map values as enabled.");
  }
  if (hasPerm({ management: false }, "management")) {
    fail("hasPerm should reject falsy map values.");
  }
  pass("Permission helper logic is correct.");
}

main();
