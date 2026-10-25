import { useEffect, useState } from "react";
import { TomatoMark } from "./components/TomatoMark";
import { useAuth } from "./context/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { AdminPage } from "./pages/AdminPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TasksPage } from "./pages/TasksPage";
import type { AppView } from "./types";

export default function App() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<AppView>("tasks");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setSelectedTaskId(null);
      return;
    }

    const storedTaskId = localStorage.getItem(selectedTaskStorageKey(user.id));
    const parsedTaskId = storedTaskId === null ? null : Number(storedTaskId);
    setSelectedTaskId(
      parsedTaskId !== null && Number.isInteger(parsedTaskId) && parsedTaskId > 0
        ? parsedTaskId
        : null,
    );
  }, [user?.id]);

  function selectTask(taskId: number | null) {
    setSelectedTaskId(taskId);
    if (!user) return;

    const storageKey = selectedTaskStorageKey(user.id);
    if (taskId === null) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, String(taskId));
    }
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <TomatoMark />
        <p>Загружаем рабочее пространство…</p>
      </main>
    );
  }

  if (!user) return <AuthPage />;

  if (view === "history") return <HistoryPage onNavigate={setView} />;
  if (view === "settings") return <SettingsPage onNavigate={setView} />;
  if (view === "admin" && user.role === "admin") {
    return <AdminPage onNavigate={setView} />;
  }
  if (view === "profile") return <ProfilePage onNavigate={setView} />;

  return (
    <TasksPage
      selectedTaskId={selectedTaskId}
      onSelectTask={selectTask}
      onNavigate={setView}
    />
  );
}

function selectedTaskStorageKey(userId: number) {
  return `pomodoro_tracker_selected_task_${userId}`;
}

