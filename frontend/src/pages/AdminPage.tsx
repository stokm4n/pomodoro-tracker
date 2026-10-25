import { useEffect, useState } from "react";
import {
  deleteAdminUser,
  getAdminStatistics,
  getAdminUser,
  getAdminUsers,
} from "../api/admin";
import { ApiError } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../context/AuthContext";
import type {
  AdminSystemStatistics,
  AdminUserDetails,
  AdminUserSummary,
  AppView,
} from "../types";

interface AdminPageProps {
  onNavigate: (view: AppView) => void;
}

export function AdminPage({ onNavigate }: AdminPageProps) {
  const { user, token, logout } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [statistics, setStatistics] = useState<AdminSystemStatistics | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingUserId, setLoadingUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    void loadDashboard();
  }, [token, user?.role]);

  async function loadDashboard() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [nextUsers, nextStatistics] = await Promise.all([
        getAdminUsers(token),
        getAdminStatistics(token),
      ]);
      setUsers(nextUsers);
      setStatistics(nextStatistics);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setLoading(false);
    }
  }

  async function showUser(userId: number) {
    if (!token) return;
    setLoadingUserId(userId);
    setError("");
    try {
      setSelectedUser(await getAdminUser(token, userId));
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setLoadingUserId(null);
    }
  }

  async function removeUser(item: AdminUserSummary) {
    if (
      !token
      || item.id === user?.id
      || !window.confirm(
        `Удалить пользователя «${item.username}»? Его задачи, настройки и история сессий будут удалены без возможности восстановления.`,
      )
    ) return;

    setDeletingUserId(item.id);
    setError("");
    try {
      await deleteAdminUser(token, item.id);
      if (selectedUser?.id === item.id) setSelectedUser(null);
      const [nextUsers, nextStatistics] = await Promise.all([
        getAdminUsers(token),
        getAdminStatistics(token),
      ]);
      setUsers(nextUsers);
      setStatistics(nextStatistics);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setDeletingUserId(null);
    }
  }

  function handleRequestError(requestError: unknown) {
    if (requestError instanceof ApiError && requestError.status === 401) {
      logout();
      return;
    }
    setError(
      requestError instanceof ApiError && requestError.status === 403
        ? "Доступ разрешён только администратору"
        : requestError instanceof ApiError
          ? requestError.message
          : "Не удалось связаться с сервером",
    );
  }

  return (
    <div className="app-shell" id="top">
      <AppHeader currentView="admin" onNavigate={onNavigate} />

      <main className="admin-page">
        <section className="dashboard-intro admin-intro">
          <div>
            <span className="eyebrow">Управление системой</span>
            <h1>Администрирование</h1>
            <p>Просматривайте пользователей и общие показатели приложения.</p>
          </div>
        </section>

        {error && <p className="page-error" role="alert">{error}</p>}

        {loading ? (
          <div className="admin-loading">Загружаем данные…</div>
        ) : (
          <>
            {statistics && (
              <section className="admin-summary" aria-label="Статистика системы">
                <AdminMetric label="Пользователей" value={statistics.total_users} />
                <AdminMetric label="Задач" value={statistics.total_tasks} />
                <AdminMetric label="Выполнено задач" value={statistics.completed_tasks} />
                <AdminMetric label="Завершено Pomodoro" value={statistics.completed_pomodoros} />
                <AdminMetric
                  label="Общее время фокуса"
                  value={formatFocusTime(statistics.total_focus_seconds)}
                />
              </section>
            )}

            <div className="admin-grid">
              <section className="admin-users-card" aria-labelledby="admin-users-title">
                <div className="admin-card-heading">
                  <div>
                    <span className="eyebrow">Учётные записи</span>
                    <h2 id="admin-users-title">Пользователи</h2>
                  </div>
                  <span className="admin-count">{users.length}</span>
                </div>

                {users.length === 0 ? (
                  <div className="admin-empty">Пользователей пока нет.</div>
                ) : (
                  <ul className="admin-users-list">
                    {users.map((item) => (
                      <li key={item.id} className={selectedUser?.id === item.id ? "selected" : ""}>
                        <span className="admin-user-avatar" aria-hidden="true">
                          {item.avatar_data ? (
                            <img src={item.avatar_data} alt="" />
                          ) : (
                            item.username.charAt(0).toUpperCase()
                          )}
                        </span>
                        <div className="admin-user-copy">
                          <div>
                            <strong>{item.username}</strong>
                            <span className={`admin-role admin-role-${item.role}`}>
                              {item.role === "admin" ? "Администратор" : "Пользователь"}
                            </span>
                            {item.id === user?.id && <span className="admin-current">Вы</span>}
                          </div>
                          <span>Регистрация: {formatDate(item.created_at)}</span>
                        </div>
                        <div className="admin-user-numbers">
                          <span><strong>{item.task_count}</strong> задач</span>
                          <span><strong>{item.completed_pomodoros}</strong> Pomodoro</span>
                        </div>
                        <div className="admin-user-actions">
                          <button
                            className="button button-quiet button-small"
                            type="button"
                            disabled={loadingUserId === item.id}
                            onClick={() => showUser(item.id)}
                          >
                            {loadingUserId === item.id ? "Загружаем…" : "Подробнее"}
                          </button>
                          <button
                            className="admin-delete-button"
                            type="button"
                            disabled={item.id === user?.id || deletingUserId === item.id}
                            title={item.id === user?.id ? "Нельзя удалить собственный аккаунт" : undefined}
                            onClick={() => removeUser(item)}
                          >
                            {deletingUserId === item.id ? "Удаляем…" : "Удалить"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <aside className="admin-details-card" aria-live="polite">
                {selectedUser ? (
                  <>
                    <span className="eyebrow">Подробная информация</span>
                    <div className="admin-details-user">
                      <span className="admin-user-avatar" aria-hidden="true">
                        {selectedUser.avatar_data ? (
                          <img src={selectedUser.avatar_data} alt="" />
                        ) : (
                          selectedUser.username.charAt(0).toUpperCase()
                        )}
                      </span>
                      <div>
                        <h2>{selectedUser.username}</h2>
                        <span>{selectedUser.role === "admin" ? "Администратор" : "Пользователь"}</span>
                      </div>
                    </div>
                    <dl className="admin-details-list">
                      <AdminDetail label="Дата регистрации" value={formatDate(selectedUser.created_at)} />
                      <AdminDetail label="Активные задачи" value={selectedUser.active_tasks} />
                      <AdminDetail label="Выполненные задачи" value={selectedUser.completed_tasks} />
                      <AdminDetail label="Всего задач" value={selectedUser.task_count} />
                      <AdminDetail label="Завершено Pomodoro" value={selectedUser.completed_pomodoros} />
                      <AdminDetail label="Время фокуса" value={formatFocusTime(selectedUser.focus_seconds)} />
                    </dl>
                  </>
                ) : (
                  <div className="admin-details-empty">
                    <span className="empty-mark" aria-hidden="true">i</span>
                    <h2>Выберите пользователя</h2>
                    <p>Нажмите «Подробнее», чтобы увидеть его показатели.</p>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: string | number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function AdminDetail({ label, value }: { label: string; value: string | number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatFocusTime(totalSeconds: number) {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}
