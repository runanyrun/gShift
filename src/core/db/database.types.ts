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
          slug: string;
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
          slug?: string;
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
          slug?: string;
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
      company_memberships: {
        Row: {
          id: string;
          auth_user_id: string;
          company_id: string;
          role: UserRole;
          status: "active" | "inactive";
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          company_id: string;
          role?: UserRole;
          status?: "active" | "inactive";
          created_at?: string;
        };
        Update: {
          auth_user_id?: string;
          company_id?: string;
          role?: UserRole;
          status?: "active" | "inactive";
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
          acceptance_status: "pending" | "accepted" | "declined";
          responded_at: string | null;
          responded_by: string | null;
          response_note: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          starts_at: string;
          ends_at: string;
          acceptance_status?: "pending" | "accepted" | "declined";
          responded_at?: string | null;
          responded_by?: string | null;
          response_note?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          company_id?: string;
          user_id?: string;
          starts_at?: string;
          ends_at?: string;
          acceptance_status?: "pending" | "accepted" | "declined";
          responded_at?: string | null;
          responded_by?: string | null;
          response_note?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      marketplace_job_posts: {
        Row: {
          id: string;
          company_id: string;
          title: string;
          starts_at: string;
          ends_at: string;
          location_id: string | null;
          pay_rate: number | null;
          status: "draft" | "open" | "assigned" | "closed" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          title: string;
          starts_at: string;
          ends_at: string;
          location_id?: string | null;
          pay_rate?: number | null;
          status?: "draft" | "open" | "assigned" | "closed" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          title?: string;
          starts_at?: string;
          ends_at?: string;
          location_id?: string | null;
          pay_rate?: number | null;
          status?: "draft" | "open" | "assigned" | "closed" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketplace_applications: {
        Row: {
          id: string;
          post_id: string;
          worker_user_id: string;
          status: "submitted" | "reviewing" | "rejected" | "invited" | "accepted";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          worker_user_id: string;
          status?: "submitted" | "reviewing" | "rejected" | "invited" | "accepted";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          post_id?: string;
          worker_user_id?: string;
          status?: "submitted" | "reviewing" | "rejected" | "invited" | "accepted";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketplace_assignments: {
        Row: {
          id: string;
          post_id: string;
          worker_user_id: string;
          company_id: string;
          starts_at: string;
          ends_at: string;
          status: "active" | "completed" | "cancelled";
          scheduled_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          worker_user_id: string;
          company_id: string;
          starts_at: string;
          ends_at: string;
          status?: "active" | "completed" | "cancelled";
          scheduled_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          post_id?: string;
          worker_user_id?: string;
          company_id?: string;
          starts_at?: string;
          ends_at?: string;
          status?: "active" | "completed" | "cancelled";
          scheduled_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketplace_work_logs: {
        Row: {
          id: string;
          assignment_id: string;
          clock_in: string;
          clock_out: string | null;
          minutes: number | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          clock_in: string;
          clock_out?: string | null;
          minutes?: number | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          clock_in?: string;
          clock_out?: string | null;
          minutes?: number | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketplace_ratings: {
        Row: {
          id: string;
          assignment_id: string;
          company_to_worker_score: number | null;
          worker_to_company_score: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          company_to_worker_score?: number | null;
          worker_to_company_score?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          company_to_worker_score?: number | null;
          worker_to_company_score?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketplace_private_invites: {
        Row: {
          id: string;
          company_id: string;
          worker_user_id: string;
          note: string | null;
          starts_after: string | null;
          status: "pending" | "accepted" | "expired" | "cancelled";
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          worker_user_id: string;
          note?: string | null;
          starts_after?: string | null;
          status?: "pending" | "accepted" | "expired" | "cancelled";
          created_at?: string;
        };
        Update: {
          company_id?: string;
          worker_user_id?: string;
          note?: string | null;
          starts_after?: string | null;
          status?: "pending" | "accepted" | "expired" | "cancelled";
          created_at?: string;
        };
        Relationships: [];
      };
      job_titles: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          tenant_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone1: string | null;
          phone2: string | null;
          gender: string | null;
          birth_date: string | null;
          is_active: boolean;
          job_title_id: string | null;
          department_id: string | null;
          start_date: string | null;
          end_date: string | null;
          payroll_id: string | null;
          default_break_minutes: number | null;
          default_shift_hours: number | null;
          notes: string | null;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone1?: string | null;
          phone2?: string | null;
          gender?: string | null;
          birth_date?: string | null;
          is_active?: boolean;
          job_title_id?: string | null;
          department_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          payroll_id?: string | null;
          default_break_minutes?: number | null;
          default_shift_hours?: number | null;
          notes?: string | null;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone1?: string | null;
          phone2?: string | null;
          gender?: string | null;
          birth_date?: string | null;
          is_active?: boolean;
          job_title_id?: string | null;
          department_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          payroll_id?: string | null;
          default_break_minutes?: number | null;
          default_shift_hours?: number | null;
          notes?: string | null;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      employee_locations: {
        Row: {
          tenant_id: string;
          employee_id: string;
          location_id: string;
          created_at: string;
        };
        Insert: {
          tenant_id: string;
          employee_id: string;
          location_id: string;
          created_at?: string;
        };
        Update: {
          tenant_id?: string;
          employee_id?: string;
          location_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      employee_invites: {
        Row: {
          id: string;
          tenant_id: string;
          employee_id: string;
          email: string;
          token_hash: string;
          expires_at: string;
          status: "pending" | "accepted" | "revoked" | "expired";
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          employee_id: string;
          email: string;
          token_hash: string;
          expires_at: string;
          status: "pending" | "accepted" | "revoked" | "expired";
          created_by: string;
          created_at?: string;
        };
        Update: {
          tenant_id?: string;
          employee_id?: string;
          email?: string;
          token_hash?: string;
          expires_at?: string;
          status?: "pending" | "accepted" | "revoked" | "expired";
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      employee_permissions: {
        Row: {
          tenant_id: string;
          employee_id: string;
          permission_key:
            | "administration"
            | "management"
            | "report_management"
            | "time_off_management"
            | "timesheet_management";
          created_at: string;
        };
        Insert: {
          tenant_id: string;
          employee_id: string;
          permission_key:
            | "administration"
            | "management"
            | "report_management"
            | "time_off_management"
            | "timesheet_management";
          created_at?: string;
        };
        Update: {
          tenant_id?: string;
          employee_id?: string;
          permission_key?:
            | "administration"
            | "management"
            | "report_management"
            | "time_off_management"
            | "timesheet_management";
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_user_company_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_tenant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
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
      is_management_user: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_administration_user: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      has_permission: {
        Args: {
          p_key: string;
        };
        Returns: boolean;
      };
      get_my_employee: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["employees"]["Row"][];
      };
      accept_employee_invite: {
        Args: {
          p_raw_token: string;
        };
        Returns: {
          employee_id: string;
          tenant_id: string;
        }[];
      };
      respond_to_shift: {
        Args: {
          p_shift_id: string;
          p_status: string;
          p_note?: string | null;
        };
        Returns: {
          id: string;
          acceptance_status: "pending" | "accepted" | "declined";
          responded_at: string;
        }[];
      };
      debug_auth_context: {
        Args: Record<string, never>;
        Returns: {
          auth_uid: string | null;
          auth_role: string | null;
          jwt: string | null;
          headers: string | null;
        };
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
