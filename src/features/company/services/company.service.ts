import { TypedSupabaseClient } from "../../../core/db/supabase";
import { withCompanyScope } from "../../../core/permissions/tenant-scope";
import { Company, CreateCompanyInput } from "../types/company.types";

function mapCompanyRowToCompany(row: {
  id: string;
  name: string;
  sector: string | null;
  country_code: string | null;
  currency_code: string | null;
  timezone: string | null;
  plan_type: string | null;
  subscription_status: string | null;
  created_at: string;
}): Company {
  return {
    id: row.id,
    name: row.name,
    sector: row.sector,
    countryCode: row.country_code,
    currencyCode: row.currency_code,
    timezone: row.timezone,
    planType: row.plan_type,
    subscriptionStatus: row.subscription_status,
    createdAt: row.created_at,
  };
}

export class CompanyService {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async createCompany(input: CreateCompanyInput): Promise<Company> {
    const companyName = input.name.trim();
    if (!companyName) {
      throw new Error("Company name is required.");
    }

    const { data, error } = await this.supabase
      .from("companies")
      .insert({
        name: companyName,
        sector: input.sector ?? null,
        country_code: input.countryCode ?? null,
        currency_code: input.currencyCode ?? null,
        timezone: input.timezone ?? null,
        plan_type: input.planType ?? null,
        subscription_status: input.subscriptionStatus ?? null,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create company: ${error.message}`);
    }

    return mapCompanyRowToCompany(data);
  }

  async getCompanyById(companyId: string): Promise<Company | null> {
    const { data, error } = await this.supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch company: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return mapCompanyRowToCompany(data);
  }

  async getScopedCompany(companyId: string): Promise<Company | null> {
    const scopedQuery = withCompanyScope(
      this.supabase.from("companies").select("*"),
      companyId,
      "id",
    );
    const { data, error } = await scopedQuery.maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch scoped company: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return mapCompanyRowToCompany(data);
  }
}
