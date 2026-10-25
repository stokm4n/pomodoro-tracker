import { apiRequest } from "./client";
import type {
  AdminSystemStatistics,
  AdminUserDetails,
  AdminUserSummary,
} from "../types";

export async function getAdminUsers(token: string): Promise<AdminUserSummary[]> {
  const response = await apiRequest<{ users: AdminUserSummary[] }>(
    "/admin/users",
    {},
    token,
  );
  return response.users;
}

export async function getAdminUser(
  token: string,
  userId: number,
): Promise<AdminUserDetails> {
  const response = await apiRequest<{ user: AdminUserDetails }>(
    `/admin/users/${userId}`,
    {},
    token,
  );
  return response.user;
}

export function deleteAdminUser(token: string, userId: number): Promise<void> {
  return apiRequest<void>(`/admin/users/${userId}`, { method: "DELETE" }, token);
}

export async function getAdminStatistics(
  token: string,
): Promise<AdminSystemStatistics> {
  const response = await apiRequest<{ statistics: AdminSystemStatistics }>(
    "/admin/statistics",
    {},
    token,
  );
  return response.statistics;
}
