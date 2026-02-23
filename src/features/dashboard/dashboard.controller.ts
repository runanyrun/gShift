import { TypedSupabaseClient } from "../../core/db/supabase";
import { DashboardShiftItem, DashboardOverview } from "./dashboard.types";
import { DashboardService } from "./services/dashboard.service";

export class DashboardController {
  private readonly dashboardService: DashboardService;

  constructor(private readonly supabase: TypedSupabaseClient) {
    this.dashboardService = new DashboardService(supabase);
  }

  async getOverviewForCurrentUser(authUserId: string): Promise<DashboardOverview> {
    return this.dashboardService.getOverview(authUserId);
  }

  async getShiftsForCurrentUser(authUserId: string): Promise<DashboardShiftItem[]> {
    return this.dashboardService.getShifts(authUserId);
  }
}
