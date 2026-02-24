export interface MeResponseData {
  user: {
    id: string;
    email: string | null;
    name: string | null;
  };
  tenant: {
    id: string;
    name: string | null;
  } | null;
  permissions: string[] | Record<string, unknown> | null;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}
