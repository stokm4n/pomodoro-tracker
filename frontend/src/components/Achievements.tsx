import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import { getStatistics } from "../api/statistics";
import { useAuth } from "../context/AuthContext";
import type { Statistics } from "../types";

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unit: string;
}

export function Achievements() {
  const { token, logout } = useAuth();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setError("");
    getStatistics(token, "all")
      .then(setStatistics)
      .catch((requestError: unknown) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          logout();
          return;
        }
        setError("Не удалось загрузить достижения");
      });
  }, [token]);

  const achievements = useMemo(
    () => statistics ? buildAchievements(statistics) : [],
    [statistics],
  );
  const unlockedCount = achievements.filter(isUnlocked).length;

  return (
    <section className="profile-card achievements-card">
      <div className="achievements-heading">
        <div className="profile-card-heading">
          <span className="eyebrow">Прогресс</span>
          <h2>Достижения</h2>
          <p>Награды открываются автоматически за работу в Pomodoro Tracker.</p>
        </div>
        {statistics && (
          <div className="achievements-total">
            <strong>{unlockedCount}/{achievements.length}</strong>
            <span>получено</span>
          </div>
        )}
      </div>

      {error && <p className="page-error" role="alert">{error}</p>}

      {!statistics && !error ? (
        <div className="achievements-loading">Загружаем достижения…</div>
      ) : (
        <div className="achievements-grid">
          {achievements.map((achievement) => {
            const unlocked = isUnlocked(achievement);
            const progress = Math.min(100, (achievement.current / achievement.target) * 100);
            return (
              <article
                key={achievement.id}
                className={`achievement-item ${unlocked ? "is-unlocked" : "is-locked"}`}
              >
                <div className="achievement-topline">
                  <span className="achievement-icon" aria-hidden="true">
                    {achievement.icon}
                  </span>
                  <span className="achievement-state">
                    {unlocked ? "Получено" : "В процессе"}
                  </span>
                </div>
                <h3>{achievement.title}</h3>
                <p>{achievement.description}</p>
                <div className="achievement-progress" aria-hidden="true">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <strong className="achievement-counter">
                  {Math.min(achievement.current, achievement.target)} из {achievement.target} {achievement.unit}
                </strong>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function buildAchievements(statistics: Statistics): Achievement[] {
  const focusHours = Math.floor(statistics.focus_seconds / 3600);
  const longestStreak = calculateLongestStreak(statistics);

  return [
    {
      id: "first-pomodoro",
      icon: "🍅",
      title: "Первый шаг",
      description: "Завершить первую фокус-сессию.",
      current: statistics.completed_pomodoros,
      target: 1,
      unit: "Pomodoro",
    },
    {
      id: "ten-pomodoros",
      icon: "⚡",
      title: "Набираем темп",
      description: "Завершить 10 фокус-сессий.",
      current: statistics.completed_pomodoros,
      target: 10,
      unit: "Pomodoro",
    },
    {
      id: "fifty-pomodoros",
      icon: "🏅",
      title: "Полсотни",
      description: "Завершить 50 фокус-сессий.",
      current: statistics.completed_pomodoros,
      target: 50,
      unit: "Pomodoro",
    },
    {
      id: "hundred-pomodoros",
      icon: "🏆",
      title: "Мастер фокуса",
      description: "Завершить 100 фокус-сессий.",
      current: statistics.completed_pomodoros,
      target: 100,
      unit: "Pomodoro",
    },
    {
      id: "five-hours",
      icon: "⏳",
      title: "Пять часов концентрации",
      description: "Накопить пять часов чистого фокуса.",
      current: focusHours,
      target: 5,
      unit: "ч",
    },
    {
      id: "ten-tasks",
      icon: "✓",
      title: "Задача за задачей",
      description: "Полностью выполнить 10 задач.",
      current: statistics.completed_tasks,
      target: 10,
      unit: "задач",
    },
    {
      id: "three-day-streak",
      icon: "🔥",
      title: "Три дня в ритме",
      description: "Работать по Pomodoro три дня подряд.",
      current: longestStreak,
      target: 3,
      unit: "дней",
    },
    {
      id: "seven-day-streak",
      icon: "🌟",
      title: "Неделя дисциплины",
      description: "Поддерживать серию семь дней подряд.",
      current: longestStreak,
      target: 7,
      unit: "дней",
    },
  ];
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

function isUnlocked(achievement: Achievement) {
  return achievement.current >= achievement.target;
}
