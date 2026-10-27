import { apiRequest } from "./client";
import type {
  BreakActivity,
  PomodoroSession,
  SessionHistoryItem,
  SessionType,
} from "../types";

interface SessionResponse {
  session: PomodoroSession;
}

interface SessionHistoryResponse {
  sessions: SessionHistoryItem[];
}

export interface SessionCompletionResponse extends SessionResponse {
  next_session_type: SessionType;
  completed_work_count: number;
}

export interface StartSessionInput {
  session_type: SessionType;
  task_id: number | null;
  break_activities: BreakActivity[];
}

export async function startSession(
  token: string,
  input: StartSessionInput,
): Promise<PomodoroSession> {
  const response = await apiRequest<SessionResponse>(
    "/sessions/start",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
  return response.session;
}

export async function getCurrentSession(token: string): Promise<PomodoroSession> {
  const response = await apiRequest<SessionResponse>("/sessions/current", {}, token);
  return response.session;
}

export async function getSessionHistory(token: string): Promise<SessionHistoryItem[]> {
  const response = await apiRequest<SessionHistoryResponse>(
    "/sessions/history",
    {},
    token,
  );
  return response.sessions;
}

async function changeSessionState(
  token: string,
  sessionId: number,
  action: "pause" | "resume" | "complete" | "cancel",
): Promise<PomodoroSession> {
  const response = await apiRequest<SessionResponse>(
    `/sessions/${sessionId}/${action}`,
    { method: "POST" },
    token,
  );
  return response.session;
}

export const pauseSession = (token: string, sessionId: number) =>
  changeSessionState(token, sessionId, "pause");

export const resumeSession = (token: string, sessionId: number) =>
  changeSessionState(token, sessionId, "resume");

export async function completeSession(
  token: string,
  sessionId: number,
): Promise<SessionCompletionResponse> {
  return apiRequest<SessionCompletionResponse>(
    `/sessions/${sessionId}/complete`,
    { method: "POST" },
    token,
  );
}

export const cancelSession = (token: string, sessionId: number) =>
  changeSessionState(token, sessionId, "cancel");

export async function saveReadiness(
  token: string,
  sessionId: number,
  score: number,
): Promise<PomodoroSession> {
  const response = await apiRequest<SessionResponse>(
    `/sessions/${sessionId}/readiness`,
    { method: "POST", body: JSON.stringify({ score }) },
    token,
  );
  return response.session;
}
