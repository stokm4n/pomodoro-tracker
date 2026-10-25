import { useEffect, useMemo, useState } from "react";
import * as tasksApi from "../api/tasks";
import { ApiError } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { TaskForm } from "../components/TaskForm";
import { TaskItem } from "../components/TaskItem";
import { TimerPanel } from "../components/TimerPanel";
import { useAuth } from "../context/AuthContext";
import type { Task, TaskInput, TaskUpdate } from "../types";
import type { AppView } from "../types";

interface TasksPageProps {
  onNavigate: (view: AppView) => void;
  selectedTaskId: number | null;
  onSelectTask: (taskId: number | null) => void;
}

export function TasksPage({ onNavigate, selectedTaskId, onSelectTask }: TasksPageProps) {
  const { token, logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    tasksApi
      .getTasks(token)
      .then((loadedTasks) => {
        setTasks(loadedTasks);
        if (
          selectedTaskId !== null
          && !loadedTasks.some(
            (task) => task.id === selectedTaskId && task.status === "active",
          )
        ) {
          onSelectTask(null);
        }
      })
      .catch(handleRequestError)
      .finally(() => setLoading(false));
  }, [token]);

  const summary = useMemo(() => {
    const completed = tasks.filter((task) => task.status === "completed").length;
    return {
      completed,
      active: tasks.length - completed,
      percent: tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100),
    };
  }, [tasks]);

  function handleRequestError(requestError: unknown) {
    if (requestError instanceof ApiError && requestError.status === 401) {
      logout();
      return;
    }
    setError(
      requestError instanceof ApiError
        ? requestError.message
        : "Не удалось связаться с сервером",
    );
  }

  async function createTask(input: TaskInput) {
    if (!token) return;
    setSubmitting(true);
    setError("");
    try {
      const task = await tasksApi.createTask(token, input);
      setTasks((current) => [task, ...current]);
    } catch (requestError) {
      handleRequestError(requestError);
      throw requestError;
    } finally {
      setSubmitting(false);
    }
  }

  async function updateTask(taskId: number, input: TaskUpdate) {
    if (!token) return;
    setBusyTaskId(taskId);
    setError("");
    try {
      const updatedTask = await tasksApi.updateTask(token, taskId, input);
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updatedTask : task)),
      );
      if (updatedTask.status === "completed" && selectedTaskId === taskId) {
        onSelectTask(null);
      }
    } catch (requestError) {
      handleRequestError(requestError);
      throw requestError;
    } finally {
      setBusyTaskId(null);
    }
  }

  async function deleteTask(taskId: number) {
    if (
      !token
      || !window.confirm("Убрать задачу из рабочего списка? Её статистика сохранится.")
    ) return;
    setBusyTaskId(taskId);
    setError("");
    try {
      await tasksApi.deleteTask(token, taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
      if (selectedTaskId === taskId) onSelectTask(null);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setBusyTaskId(null);
    }
  }

  function selectTask(taskId: number) {
    onSelectTask(selectedTaskId === taskId ? null : taskId);
  }

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  return (
    <div className="app-shell" id="top">
      <AppHeader currentView="tasks" onNavigate={onNavigate} />

      <main className="dashboard">
        <section className="dashboard-intro">
          <div>
            <span className="eyebrow">Рабочее пространство</span>
            <h1>Фокус на сегодня</h1>
          </div>
        </section>

        {error && <p className="page-error" role="alert">{error}</p>}

        <div className="focus-grid">
          <aside className="focus-timer-column">
            <TimerPanel
              selectedTaskId={selectedTask?.id ?? null}
              onSelectTask={onSelectTask}
            />

            <section className="progress-card" aria-labelledby="progress-title">
              <div className="section-heading section-heading-small">
                <div>
                  <span className="eyebrow">Прогресс</span>
                  <h2 id="progress-title">Задачи</h2>
                </div>
                <strong>{summary.percent}%</strong>
              </div>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${summary.percent}%` }} />
              </div>
              <div className="summary-row">
                <span><strong>{summary.active}</strong> в работе</span>
                <span><strong>{summary.completed}</strong> выполнено</span>
              </div>
            </section>
          </aside>

          <div className="focus-tasks-column">
            <TaskForm submitting={submitting} onSubmit={createTask} />

            <section className="task-list-card" aria-labelledby="task-list-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Список</span>
                <h2 id="task-list-title">Ваши задачи</h2>
              </div>
              <span className="task-count">{tasks.length}</span>
            </div>

            {selectedTask && (
              <div className="selected-task-banner">
                <span>Выбрано для следующего Pomodoro</span>
                <strong>{selectedTask.title}</strong>
              </div>
            )}

            {loading ? (
              <div className="empty-state">Загружаем задачи…</div>
            ) : tasks.length === 0 ? (
              <div className="empty-state">
                <span className="empty-mark" aria-hidden="true">01</span>
                <h3>Начните с одной задачи</h3>
                <p>Добавьте первое дело слева — оно появится здесь.</p>
              </div>
            ) : (
              <ul className="task-list">
                {tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    busy={busyTaskId === task.id}
                    selected={selectedTaskId === task.id}
                    onSelect={selectTask}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                  />
                ))}
              </ul>
            )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

