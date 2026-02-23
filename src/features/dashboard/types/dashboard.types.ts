import { UserRole } from "../../../core/db/database.types";

export interface DashboardBootstrapPayload {
  user: {
    authUserId: string;
    companyId: string;
    role: UserRole;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  company: {
    id: string;
    name: string;
    sector: string | null;
    countryCode: string | null;
    currencyCode: string | null;
    timezone: string | null;
    planType: string | null;
    subscriptionStatus: string | null;
  };
  metrics: {
    usersCount: number;
  };
}
