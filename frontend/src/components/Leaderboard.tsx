import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { getLeaderboard } from "../api/statistics";
import { useAuth } from "../context/AuthContext";
import type { Leaderboard as LeaderboardData, LeaderboardPeriod } from "../types";
import { buildAchievements, isAchievementUnlocked } from "../utils/achievements";
import { getUserLevelProgress } from "../utils/userLevels";
import { UserLevelAvatar } from "./UserLevelAvatar";

const periodLabels: Record<LeaderboardPeriod, string> = {
  week: "7 дней",
  all: "Всё время",
};

export function Leaderboard() {
  const { token, user, logout } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openedProfileId, setOpenedProfileId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    getLeaderboard(token, period)
      .then(setLeaderboard)
      .catch((requestError: unknown) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          logout();
          return;
        }
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Не удалось загрузить рейтинг",
        );
      })
      .finally(() => setLoading(false));
  }, [token, period]);

  return (
    <section className="leaderboard-card" aria-labelledby="leaderboard-title">
      <div className="leaderboard-heading">
        <div>
          <span className="eyebrow">Сообщество</span>
          <h2 id="leaderboard-title">Leaderboard</h2>
          <p>Рейтинг по фактическому времени фокуса.</p>
        </div>
        <div className="statistics-periods" aria-label="Период рейтинга">
          {(Object.keys(periodLabels) as LeaderboardPeriod[]).map((item) => (
            <button
              key={item}
              className={period === item ? "active" : ""}
              type="button"
              onClick={() => setPeriod(item)}
            >
              {periodLabels[item]}
            </button>
          ))}
        </div>
      </div>

      {!user?.leaderboard_visible && (
        <p className="leaderboard-privacy-note">
          Вы не участвуете в рейтинге. Включить участие можно в профиле, в разделе
          «Конфиденциальность».
        </p>
      )}

      {error && <p className="page-error" role="alert">{error}</p>}

      {loading && !leaderboard ? (
        <div className="leaderboard-empty">Загружаем рейтинг…</div>
      ) : leaderboard?.entries.length ? (
        <ol className="leaderboard-list">
          {leaderboard.entries.map((entry) => {
            const achievements = buildAchievements({
              completedPomodoros: entry.total_completed_pomodoros,
              focusSeconds: entry.total_focus_seconds,
              completedTasks: entry.total_completed_tasks,
              longestStreak: entry.longest_streak,
            });
            const unlockedAchievements = achievements.filter(isAchievementUnlocked);
            const levelProgress = getUserLevelProgress(entry.total_completed_pomodoros);

            return (
            <li
              key={entry.user_id}
              className={`${entry.is_current_user ? "is-current" : ""} ${openedProfileId === entry.user_id ? "is-open" : ""}`}
            >
              <div className="leaderboard-entry-summary">
                <span className="leaderboard-rank">{formatRank(entry.rank)}</span>
                <span className="leaderboard-avatar" aria-hidden="true">
                  {entry.avatar_data ? (
                    <img src={entry.avatar_data} alt="" />
                  ) : (
                    entry.username.charAt(0).toUpperCase()
                  )}
                </span>
                <div className="leaderboard-user">
                  <strong>{entry.username}</strong>
                  {entry.is_current_user && <span>Это вы</span>}
                  <span className="leaderboard-level-label">
                    <UserLevelAvatar level={levelProgress.level} size="small" />
                    {levelProgress.level.name}
                  </span>
                </div>
                <div className="leaderboard-result">
                  <strong>{formatFocusTime(entry.focus_seconds)}</strong>
                  <span>Фокус</span>
                </div>
                <div className="leaderboard-result">
                  <strong>{entry.completed_pomodoros}</strong>
                  <span>Pomodoro</span>
                </div>
                <button
                  className="leaderboard-profile-button"
                  type="button"
                  aria-expanded={openedProfileId === entry.user_id}
                  onClick={() => setOpenedProfileId((current) => (
                    current === entry.user_id ? null : entry.user_id
                  ))}
                >
                  {openedProfileId === entry.user_id ? "Скрыть" : "Профиль"}
                </button>
              </div>

              {openedProfileId === entry.user_id && (
                <div className="leaderboard-profile">
                  <span className="leaderboard-profile-avatar" aria-hidden="true">
                    {entry.avatar_data ? (
                      <img src={entry.avatar_data} alt="" />
                    ) : (
                      entry.username.charAt(0).toUpperCase()
                    )}
                  </span>
                  <div className="leaderboard-profile-copy">
                    <span className="eyebrow">Профиль участника</span>
                    <h3>{entry.username}</h3>
                    <p>{entry.bio || "Пользователь пока ничего о себе не рассказал."}</p>
                    <span className="leaderboard-profile-date">
                      В проекте с {formatProfileDate(entry.created_at)}
                    </span>
                    <div className="leaderboard-profile-achievements">
                      <strong>Достижения</strong>
                      {unlockedAchievements.length ? (
                        <div className="leaderboard-badges">
                          {unlockedAchievements.map((achievement) => (
                            <span key={achievement.id} title={achievement.description}>
                              <b aria-hidden="true">{achievement.icon}</b>
                              {achievement.title}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p>У пользователя пока нет открытых достижений.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </li>
            );
          })}
        </ol>
      ) : (
        <div className="leaderboard-empty">
          Пока никто не включил участие в рейтинге.
        </div>
      )}
    </section>
  );
}

function formatRank(rank: number) {
  return rank <= 99 ? String(rank).padStart(2, "0") : String(rank);
}

function formatFocusTime(totalSeconds: number) {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

function formatProfileDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
