/**
 * Local test setup:
 * 1. Run: npm run test:ui-permissions
 */
import {
  canManage,
  hasPerm,
  normalizePermissionKey,
  permissionsLoaded,
} from "../../auth/permissions";
import { fail, pass } from "./test-helpers";

function main() {
  if (!canManage(["administration", "management"])) {
    fail("canManage should allow administration/management arrays.");
  }

  if (canManage(["report_management"])) {
    fail("canManage should reject non-management permissions.");
  }

  if (!canManage(["AdMiNiStRaTiOn"])) {
    fail("canManage should be case-insensitive.");
  }

  if (!canManage([" management "])) {
    fail("canManage should trim whitespace.");
  }

  if (!hasPerm(["report-management"], "report_management")) {
    fail("hasPerm should normalize kebab-case keys.");
  }

  if (!hasPerm(["reportManagement"], "report_management")) {
    fail("hasPerm should normalize camelCase keys.");
  }

  if (!hasPerm({ reportManagement: true, report_management: false }, "report_management")) {
    fail("Map conflicts should merge with true-wins semantics.");
  }

  if (normalizePermissionKey("time_off") !== "time_off") {
    fail("normalizePermissionKey should keep snake_case stable.");
  }
  if (normalizePermissionKey("timeOff") !== "time_off") {
    fail("normalizePermissionKey should convert camelCase to snake_case.");
  }
  if (normalizePermissionKey("timeoff") !== "timeoff") {
    fail("normalizePermissionKey should keep flat lower-case tokens unchanged.");
  }

  if (!permissionsLoaded([])) {
    fail("permissionsLoaded([]) should be true.");
  }
  if (!permissionsLoaded({})) {
    fail("permissionsLoaded({}) should be true.");
  }
  if (permissionsLoaded(null)) {
    fail("permissionsLoaded(null) should be false.");
  }
  if (permissionsLoaded(undefined)) {
    fail("permissionsLoaded(undefined) should be false.");
  }

  if (hasPerm(null, "administration")) {
    fail("hasPerm(null, ...) should be false.");
  }

  if (!canManage({ management: true })) {
    fail("canManage should allow strict true map values.");
  }
  if (canManage({ management: "true" })) {
    fail("canManage should reject non-boolean map values.");
  }

  pass("Permission helper logic is correct.");
}

main();
