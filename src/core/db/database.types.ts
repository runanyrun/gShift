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
        Relationships: [];
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
          auth_user_id?: string;
          company_id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [];
      };
      shifts: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          starts_at: string;
          ends_at: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          starts_at: string;
          ends_at: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          starts_at?: string;
          ends_at?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_owner_onboarding: {
        Args: {
          p_auth_user_id: string;
          p_email: string;
          p_first_name?: string | null;
          p_last_name?: string | null;
          p_company_name?: string | null;
          p_sector?: string | null;
          p_country_code?: string | null;
          p_currency_code?: string | null;
          p_timezone?: string | null;
          p_plan_type?: string | null;
          p_subscription_status?: string | null;
        };
        Returns: {
          company_id: string;
          profile_id: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
