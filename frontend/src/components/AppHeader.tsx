import { useAuth } from "../context/AuthContext";
import type { AppView } from "../types";
import { TomatoMark } from "./TomatoMark";
import { ThemeToggle } from "./ThemeToggle";

interface AppHeaderProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export function AppHeader({ currentView, onNavigate }: AppHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="app-header">
      <button
        className="brand brand-button"
        type="button"
        onClick={() => onNavigate("tasks")}
        aria-label="Pomodoro Tracker — перейти к фокусу"
      >
        <TomatoMark />
        <span>Pomodoro Tracker</span>
      </button>

      <nav className="main-nav" aria-label="Основная навигация">
        <button
          className={currentView === "tasks" ? "active" : ""}
          type="button"
          onClick={() => onNavigate("tasks")}
        >
          Фокус
        </button>
        <button
          className={currentView === "history" ? "active" : ""}
          type="button"
          onClick={() => onNavigate("history")}
        >
          Статистика
        </button>
        <button
          className={currentView === "settings" ? "active" : ""}
          type="button"
          onClick={() => onNavigate("settings")}
        >
          Настройки
        </button>
        {user?.role === "admin" && (
          <button
            className={currentView === "admin" ? "active" : ""}
            type="button"
            onClick={() => onNavigate("admin")}
          >
            Администрирование
          </button>
        )}
      </nav>

      <div className="header-user">
        <ThemeToggle />
        <button
          className={`header-profile-button ${currentView === "profile" ? "active" : ""}`}
          type="button"
          onClick={() => onNavigate("profile")}
          aria-label="Открыть профиль"
        >
          <span className="header-avatar" aria-hidden="true">
            {user?.avatar_data ? (
              <img src={user.avatar_data} alt="" />
            ) : (
              user?.username.charAt(0).toUpperCase()
            )}
          </span>
          <span className="user-copy">
            <span className="user-label">Вы вошли как</span>
            <strong>{user?.username}</strong>
          </span>
        </button>
      </div>
    </header>
  );
}

