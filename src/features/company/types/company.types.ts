export interface CreateCompanyInput {
  name: string;
  sector?: string | null;
  countryCode?: string | null;
  currencyCode?: string | null;
  timezone?: string | null;
  planType?: string | null;
  subscriptionStatus?: string | null;
}

export interface Company {
  id: string;
  name: string;
  sector: string | null;
  countryCode: string | null;
  currencyCode: string | null;
  timezone: string | null;
  planType: string | null;
  subscriptionStatus: string | null;
  createdAt: string;
}
