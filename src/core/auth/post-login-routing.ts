import { MeResponseData } from "./me.types";
import { canManage, permissionsLoaded } from "./permissions";

export type PostLoginRoute = "/onboarding" | "/dashboard" | "/jobs";

export function resolvePostLoginRoute(me: MeResponseData): PostLoginRoute {
  if (!me.tenant || !me.employee) {
    return "/onboarding";
  }

  if (!permissionsLoaded(me.permissions)) {
    return "/jobs";
  }

  if (canManage(me.permissions)) {
    return "/dashboard";
  }

  return "/jobs";
}
