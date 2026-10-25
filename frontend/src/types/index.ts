export type UserRole = "user" | "admin";

export interface User {
  id: number;
  username: string;
  role: UserRole;
  created_at?: string;
  bio?: string;
  avatar_data?: string;
  leaderboard_visible?: boolean;
}

export interface ProfileUpdateInput {
  username: string;
  current_password?: string;
  new_password?: string;
}

export interface ProfileDetailsInput {
  bio: string;
  avatar_data: string;
}

export interface ProfilePrivacyInput {
  leaderboard_visible: boolean;
}

export type TaskStatus = "active" | "completed";

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TaskInput {
  title: string;
  description: string;
}

export interface TaskUpdate extends TaskInput {
  status: TaskStatus;
}

export type NotificationSound =
  | "classic"
  | "soft"
  | "bell"
  | "digital"
  | "people_go";

export interface Settings {
  user_id: number;
  work_duration_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  notifications_enabled: boolean;
  notification_sound: NotificationSound;
  notification_volume: number;
  updated_at: string;
}

export type SettingsInput = Omit<Settings, "user_id" | "updated_at">;

export type SessionType = "work" | "short_break" | "long_break";
export type SessionStatus = "running" | "paused" | "completed" | "cancelled";

export interface PomodoroSession {
  id: number;
  user_id: number;
  task_id: number | null;
  session_type: SessionType;
  planned_duration_seconds: number;
  elapsed_seconds: number;
  remaining_seconds: number;
  status: SessionStatus;
  started_at: string;
  state_changed_at: string;
  ended_at: string | null;
}

export interface SessionHistoryItem {
  id: number;
  task_id: number | null;
  task_title: string | null;
  session_type: SessionType;
  planned_duration_seconds: number;
  elapsed_seconds: number;
  status: "completed" | "cancelled";
  started_at: string;
  ended_at: string | null;
}

export type StatisticsPeriod = "today" | "week" | "all";

export interface DailyStatistics {
  date: string;
  completed_pomodoros: number;
  focus_seconds: number;
}

export interface TaskStatistics {
  task_id: number;
  title: string;
  completed_pomodoros: number;
  focus_seconds: number;
  deleted: boolean;
}

export interface Statistics {
  period: StatisticsPeriod;
  completed_pomodoros: number;
  focus_seconds: number;
  completed_tasks: number;
  cancelled_sessions: number;
  daily: DailyStatistics[];
  top_tasks: TaskStatistics[];
}

export type LeaderboardPeriod = "week" | "all";

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  avatar_data: string;
  bio: string;
  created_at: string;
  completed_pomodoros: number;
  focus_seconds: number;
  is_current_user: boolean;
}

export interface Leaderboard {
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
}

export interface AdminUserSummary {
  id: number;
  username: string;
  role: UserRole;
  created_at: string;
  avatar_data: string;
  task_count: number;
  completed_pomodoros: number;
  focus_seconds: number;
}

export interface AdminUserDetails extends AdminUserSummary {
  active_tasks: number;
  completed_tasks: number;
}

export interface AdminSystemStatistics {
  total_users: number;
  total_tasks: number;
  completed_tasks: number;
  completed_pomodoros: number;
  total_focus_seconds: number;
}

export type AppView = "tasks" | "history" | "settings" | "admin" | "profile";


