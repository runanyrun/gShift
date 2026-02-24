/**
 * Local test setup:
 * 1. Run: npm run test:routing
 */
import { resolvePostLoginRoute } from "../../auth/post-login-routing";
import { MeResponseData } from "../../auth/me.types";
import { fail, pass } from "./test-helpers";

function buildMe(input: Partial<MeResponseData>): MeResponseData {
  return {
    user: { id: "u1", email: "user@test.com", name: "User Test" },
    tenant: { id: "t1", name: "Tenant One" },
    permissions: null,
    employee: { id: "e1", first_name: "User", last_name: "Test", email: "user@test.com" },
    ...input,
  };
}

function main() {
  const tenantMissingRoute = resolvePostLoginRoute(buildMe({ tenant: null }));
  if (tenantMissingRoute !== "/onboarding") {
    fail(`Expected tenant null route to /onboarding, got ${tenantMissingRoute}`);
  }
  pass("tenant=null routes to /onboarding");

  const employeeMissingRoute = resolvePostLoginRoute(buildMe({ employee: null }));
  if (employeeMissingRoute !== "/onboarding") {
    fail(`Expected employee null route to /onboarding, got ${employeeMissingRoute}`);
  }
  pass("employee=null routes to /onboarding");

  const permissionsUnknownRoute = resolvePostLoginRoute(buildMe({ permissions: null }));
  if (permissionsUnknownRoute !== "/my") {
    fail(`Expected permissions=null route to /my, got ${permissionsUnknownRoute}`);
  }
  pass("permissions=null routes to safe default /my.");

  const employeeRoute = resolvePostLoginRoute(
    buildMe({ permissions: ["report_management", "timesheet_management"] }),
  );
  if (employeeRoute !== "/my") {
    fail(`Expected non-manager route to /my, got ${employeeRoute}`);
  }
  pass("non-manager routes to /my");

  const managerRoute = resolvePostLoginRoute(
    buildMe({ permissions: ["management", "report_management"] }),
  );
  if (managerRoute !== "/dashboard") {
    fail(`Expected management route to /dashboard, got ${managerRoute}`);
  }
  pass("management routes to /dashboard");
}

main();
