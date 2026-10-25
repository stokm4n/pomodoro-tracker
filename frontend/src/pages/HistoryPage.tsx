import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import { getSessionHistory } from "../api/sessions";
import { AppHeader } from "../components/AppHeader";
import { Leaderboard } from "../components/Leaderboard";
import { useAuth } from "../context/AuthContext";
import { StatisticsOverview } from "./StatisticsPage";
import type { AppView, SessionHistoryItem, SessionType } from "../types";

interface HistoryPageProps {
  onNavigate: (view: AppView) => void;
}

type TypeFilter = "all" | SessionType;

const sessionLabels: Record<SessionType, string> = {
  work: "Работа",
  short_break: "Короткий перерыв",
  long_break: "Длинный перерыв",
};

export function HistoryPage({ onNavigate }: HistoryPageProps) {
  const { token, logout } = useAuth();
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    getSessionHistory(token)
      .then(setSessions)
      .catch((requestError: unknown) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          logout();
          return;
        }
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Не удалось загрузить историю",
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  const filteredSessions = useMemo(
    () => sessions.filter((session) => {
      const matchesType = typeFilter === "all" || session.session_type === typeFilter;
      const matchesDate = !dateFilter || localDateValue(session.started_at) === dateFilter;
      return matchesType && matchesDate;
    }),
    [sessions, typeFilter, dateFilter],
  );

  return (
    <div className="app-shell" id="top">
      <AppHeader currentView="history" onNavigate={onNavigate} />

      <main className="history-page">
        <section className="dashboard-intro history-intro">
          <div>
            <span className="eyebrow">Результаты работы</span>
            <h1>Статистика</h1>
            <p>Следите за результатами и просматривайте завершённые интервалы.</p>
          </div>
        </section>

        <StatisticsOverview sessions={sessions} />

        <Leaderboard />

        {error && <p className="page-error" role="alert">{error}</p>}

        <section className="history-card" aria-labelledby="history-title">
          <div className="history-card-heading">
            <div>
              <span className="eyebrow">Сессии</span>
              <h2 id="history-title">Последние интервалы</h2>
            </div>

            <div className="history-filters" aria-label="Фильтры истории">
              <label>
                <span>Тип</span>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                >
                  <option value="all">Все интервалы</option>
                  <option value="work">Работа</option>
                  <option value="short_break">Короткий перерыв</option>
                  <option value="long_break">Длинный перерыв</option>
                </select>
              </label>
              <label>
                <span>Дата</span>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                />
              </label>
              {(typeFilter !== "all" || dateFilter) && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setTypeFilter("all");
                    setDateFilter("");
                  }}
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="empty-state history-empty">Загружаем историю…</div>
          ) : filteredSessions.length === 0 ? (
            <div className="empty-state history-empty">
              <span className="empty-mark" aria-hidden="true">00</span>
              <h3>{sessions.length === 0 ? "История пока пуста" : "Ничего не найдено"}</h3>
              <p>
                {sessions.length === 0
                  ? "Завершите первый Pomodoro — он появится здесь."
                  : "Измените или сбросьте выбранные фильтры."}
              </p>
            </div>
          ) : (
            <ul className="history-list">
              {filteredSessions.map((session) => (
                <HistoryItem key={session.id} session={session} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function HistoryItem({ session }: { session: SessionHistoryItem }) {
  const startedAt = new Date(session.started_at);
  return (
    <li className="history-item">
      <span className={`history-kind history-kind-${session.session_type}`} aria-hidden="true">
        {session.session_type === "work" ? "P" : "П"}
      </span>
      <div className="history-copy">
        <div>
          <h3>{sessionLabels[session.session_type]}</h3>
          <span className={`status status-${session.status}`}>
            {session.status === "completed" ? "Завершено" : "Отменено"}
          </span>
        </div>
        <p>
          {session.session_type === "work"
            ? session.task_title ?? "Без задачи"
            : "Перерыв"}
        </p>
      </div>
      <div className="history-duration">
        <strong>{formatDuration(session.elapsed_seconds)}</strong>
        <span>из {formatDuration(session.planned_duration_seconds)}</span>
      </div>
      <time dateTime={session.started_at}>
        <strong>{startedAt.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}</strong>
        <span>{startedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
      </time>
    </li>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function localDateValue(isoDate: string) {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
