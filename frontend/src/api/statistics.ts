import { apiRequest } from "./client";
import type {
  Leaderboard,
  LeaderboardPeriod,
  Statistics,
  StatisticsPeriod,
} from "../types";

interface StatisticsResponse {
  statistics: Statistics;
}

export async function getStatistics(
  token: string,
  period: StatisticsPeriod,
): Promise<Statistics> {
  const response = await apiRequest<StatisticsResponse>(
    `/statistics?period=${period}`,
    {},
    token,
  );
  return response.statistics;
}

export function deleteTaskFromStatistics(token: string, taskId: number): Promise<void> {
  return apiRequest<void>(
    `/statistics/tasks/${taskId}`,
    { method: "DELETE" },
    token,
  );
}

export async function getLeaderboard(
  token: string,
  period: LeaderboardPeriod,
): Promise<Leaderboard> {
  const response = await apiRequest<{ leaderboard: Leaderboard }>(
    `/leaderboard?period=${period}`,
    {},
    token,
  );
  return response.leaderboard;
}
