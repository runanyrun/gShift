import { TypedSupabaseClient } from "../../../core/db/supabase";
import { DashboardRepository } from "../dashboard.repository";
import { DashboardOverview, DashboardShiftItem } from "../dashboard.types";

export class DashboardService {
  private readonly repository: DashboardRepository;

  constructor(private readonly supabase: TypedSupabaseClient) {
    this.repository = new DashboardRepository(supabase);
  }

  async getOverview(userId: string): Promise<DashboardOverview> {
    const context = await this.repository.getCurrentTenantContext();
    if (context.authUserId !== userId) {
      throw new Error("Authenticated user mismatch.");
    }

    const [usersCount, shiftsCount] = await Promise.all([
      this.repository.getUsersCount(context.companyId),
      this.repository.getShiftsCount(context.companyId),
    ]);

    return {
      userId: context.authUserId,
      companyId: context.companyId,
      usersCount,
      shiftsCount,
    };
  }

  async getShifts(userId: string): Promise<DashboardShiftItem[]> {
    const context = await this.repository.getCurrentTenantContext();
    if (context.authUserId !== userId) {
      throw new Error("Authenticated user mismatch.");
    }

    return this.repository.getShifts(context.companyId);
  }
}
