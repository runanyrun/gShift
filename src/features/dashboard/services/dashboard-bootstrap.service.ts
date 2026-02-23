import { getCurrentUserTenantContextOrThrow } from "../../../core/auth/current-user";
import {
  createServerSupabaseClient,
  TypedSupabaseClient,
} from "../../../core/db/supabase";
import { CompanyService } from "../../company/services/company.service";
import { UserService } from "../../user/services/user.service";
import { DashboardBootstrapPayload } from "../types/dashboard.types";

export class DashboardBootstrapService {
  constructor(
    private readonly supabase: TypedSupabaseClient = createServerSupabaseClient(),
  ) {}

  async getBootstrap(): Promise<DashboardBootstrapPayload> {
    const companyService = new CompanyService(this.supabase);
    const userService = new UserService(this.supabase);

    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    const [profile, company, usersCount] = await Promise.all([
      userService.getCurrentUserProfile(context.authUserId),
      companyService.getScopedCompany(context.companyId),
      userService.countUsersByCompany(context.companyId),
    ]);

    if (!profile) {
      throw new Error("Authenticated profile was not found.");
    }

    if (!company) {
      throw new Error("Authenticated company was not found.");
    }

    return {
      user: {
        authUserId: context.authUserId,
        companyId: context.companyId,
        role: context.role,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
      },
      company: {
        id: company.id,
        name: company.name,
        sector: company.sector,
        countryCode: company.countryCode,
        currencyCode: company.currencyCode,
        timezone: company.timezone,
        planType: company.planType,
        subscriptionStatus: company.subscriptionStatus,
      },
      metrics: {
        usersCount,
      },
    };
  }
}
