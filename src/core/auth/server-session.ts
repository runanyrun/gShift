import { getAuthenticatedUserFromCookies } from "./server-auth";

export async function getServerAuthenticatedUser() {
  const { user } = await getAuthenticatedUserFromCookies();
  return user;
}
