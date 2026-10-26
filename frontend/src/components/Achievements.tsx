import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import { getStatistics } from "../api/statistics";
import { useAuth } from "../context/AuthContext";
import type { Statistics } from "../types";
import {
  buildAchievements,
  isAchievementUnlocked,
  metricsFromStatistics,
} from "../utils/achievements";

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
    () => statistics ? buildAchievements(metricsFromStatistics(statistics)) : [],
    [statistics],
  );
  const unlockedCount = achievements.filter(isAchievementUnlocked).length;

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
            const unlocked = isAchievementUnlocked(achievement);
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
