import { getSupabaseBrowserClient } from "./supabase-browser";

const ACTIVE_TENANT_KEY = "activeTenantId";

export interface TenantMembership {
  tenantId: string;
  tenantName: string;
}

function normalizeMembershipRows(rows: any[]): TenantMembership[] {
  return rows
    .map((row) => {
      const tenantId = row.tenant_id ?? row.tenants?.id;
      const tenantName = row.tenants?.display_name ?? "Unknown";
      if (!tenantId) {
        return null;
      }
      return {
        tenantId,
        tenantName,
      };
    })
    .filter((item): item is TenantMembership => Boolean(item));
}

export async function loadTenantMemberships(): Promise<TenantMembership[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, tenants(id,display_name)");

  if (error) {
    throw new Error(error.message);
  }

  return normalizeMembershipRows(data ?? []);
}

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACTIVE_TENANT_KEY);
}

export function setActiveTenantId(tenantId: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  window.dispatchEvent(new Event("active-tenant-changed"));
}
