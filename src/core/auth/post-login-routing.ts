import { MeResponseData } from "./me.types";
import { canManage } from "./permissions";

export type PostLoginRoute = "/onboarding" | "/dashboard" | "/my";

export function resolvePostLoginRoute(me: MeResponseData): PostLoginRoute {
  if (!me.tenant || !me.employee) {
    return "/onboarding";
  }

  if (canManage(me.permissions)) {
    return "/dashboard";
  }

  return "/my";
}
