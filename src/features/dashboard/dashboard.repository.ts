import { getCurrentUserTenantContextOrThrow } from "../../core/auth/current-user";
import { TypedSupabaseClient } from "../../core/db/supabase";
import { DashboardShiftItem } from "./dashboard.types";

export class DashboardRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async getCurrentTenantContext() {
    return getCurrentUserTenantContextOrThrow(this.supabase);
  }

  async getUsersCount(companyId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);

    if (error) {
      throw new Error(`Failed to count users: ${error.message}`);
    }

    return count ?? 0;
  }

  async getShiftsCount(companyId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("shifts")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);

    if (error) {
      throw new Error(`Failed to count shifts: ${error.message}`);
    }

    return count ?? 0;
  }

  async getShifts(companyId: string): Promise<DashboardShiftItem[]> {
    const { data, error } = await this.supabase
      .from("shifts")
      .select("id, company_id, user_id, starts_at, ends_at, created_by, created_at")
      .eq("company_id", companyId)
      .order("starts_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch shifts: ${error.message}`);
    }

    return data.map((row) => ({
      id: row.id,
      companyId: row.company_id,
      userId: row.user_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  }
}
