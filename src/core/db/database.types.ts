export type UserRole = "owner" | "admin" | "manager" | "employee";

export type PlanType = string;
export type SubscriptionStatus = string;

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          sector: string | null;
          country_code: string | null;
          currency_code: string | null;
          timezone: string | null;
          plan_type: PlanType | null;
          subscription_status: SubscriptionStatus | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sector?: string | null;
          country_code?: string | null;
          currency_code?: string | null;
          timezone?: string | null;
          plan_type?: PlanType | null;
          subscription_status?: SubscriptionStatus | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          sector?: string | null;
          country_code?: string | null;
          currency_code?: string | null;
          timezone?: string | null;
          plan_type?: PlanType | null;
          subscription_status?: SubscriptionStatus | null;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          auth_user_id: string;
          company_id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          company_id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          role: UserRole;
          created_at?: string;
        };
        Update: {
          company_id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
      };
    };
  };
}
