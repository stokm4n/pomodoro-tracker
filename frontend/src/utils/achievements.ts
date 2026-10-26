import type { Statistics } from "../types";

export interface AchievementMetrics {
  completedPomodoros: number;
  focusSeconds: number;
  completedTasks: number;
  longestStreak: number;
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unit: string;
}

export function buildAchievements(metrics: AchievementMetrics): Achievement[] {
  const focusHours = Math.floor(metrics.focusSeconds / 3600);

  return [
    { id: "first-pomodoro", icon: "🍅", title: "Первый шаг", description: "Завершить первую фокус-сессию.", current: metrics.completedPomodoros, target: 1, unit: "Pomodoro" },
    { id: "ten-pomodoros", icon: "⚡", title: "Набираем темп", description: "Завершить 10 фокус-сессий.", current: metrics.completedPomodoros, target: 10, unit: "Pomodoro" },
    { id: "fifty-pomodoros", icon: "🏅", title: "Полсотни", description: "Завершить 50 фокус-сессий.", current: metrics.completedPomodoros, target: 50, unit: "Pomodoro" },
    { id: "hundred-pomodoros", icon: "🏆", title: "Мастер фокуса", description: "Завершить 100 фокус-сессий.", current: metrics.completedPomodoros, target: 100, unit: "Pomodoro" },
    { id: "five-hours", icon: "⏳", title: "Пять часов концентрации", description: "Накопить пять часов чистого фокуса.", current: focusHours, target: 5, unit: "ч" },
    { id: "ten-tasks", icon: "✓", title: "Задача за задачей", description: "Полностью выполнить 10 задач.", current: metrics.completedTasks, target: 10, unit: "задач" },
    { id: "three-day-streak", icon: "🔥", title: "Три дня в ритме", description: "Работать по Pomodoro три дня подряд.", current: metrics.longestStreak, target: 3, unit: "дней" },
    { id: "seven-day-streak", icon: "🌟", title: "Неделя дисциплины", description: "Поддерживать серию семь дней подряд.", current: metrics.longestStreak, target: 7, unit: "дней" },
  ];
}

export function metricsFromStatistics(statistics: Statistics): AchievementMetrics {
  return {
    completedPomodoros: statistics.completed_pomodoros,
    focusSeconds: statistics.focus_seconds,
    completedTasks: statistics.completed_tasks,
    longestStreak: calculateLongestStreak(statistics),
  };
}

export function isAchievementUnlocked(achievement: Achievement) {
  return achievement.current >= achievement.target;
}

function calculateLongestStreak(statistics: Statistics) {
  const dates = statistics.daily
    .filter((day) => day.completed_pomodoros > 0)
    .map((day) => Date.parse(`${day.date}T00:00:00Z`))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  let longest = 0;
  let current = 0;
  let previous: number | null = null;
  const oneDay = 24 * 60 * 60 * 1000;

  for (const date of dates) {
    if (date === previous) continue;
    current = previous !== null && date - previous === oneDay ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}
