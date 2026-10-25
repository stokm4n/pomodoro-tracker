import { useState, type FormEvent } from "react";
import type { Task, TaskUpdate } from "../types";

interface TaskItemProps {
  task: Task;
  busy: boolean;
  selected: boolean;
  onSelect: (taskId: number) => void;
  onUpdate: (taskId: number, input: TaskUpdate) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
}

export function TaskItem({
  task,
  busy,
  selected,
  onSelect,
  onUpdate,
  onDelete,
}: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  async function toggleStatus() {
    try {
      await onUpdate(task.id, {
        title: task.title,
        description: task.description,
        status: task.status === "active" ? "completed" : "active",
      });
    } catch {
      // The page displays the API error.
    }
  }

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onUpdate(task.id, { title, description, status: task.status });
      setEditing(false);
    } catch {
      // Keep edit mode open so the user can correct and retry.
    }
  }

  function cancelEditing() {
    setTitle(task.title);
    setDescription(task.description);
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="task-item task-item-editing">
        <form onSubmit={saveChanges}>
          <label className="field field-compact">
            <span>Название</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              autoFocus
            />
          </label>
          <label className="field field-compact">
            <span>Описание</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              rows={3}
            />
          </label>
          <div className="task-actions">
            <button className="button button-primary button-small" disabled={busy}>
              Сохранить
            </button>
            <button
              className="button button-quiet button-small"
              type="button"
              onClick={cancelEditing}
              disabled={busy}
            >
              Отмена
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={`task-item ${task.status === "completed" ? "is-completed" : ""} ${selected ? "is-selected" : ""}`}
    >
      <button
        className="task-check"
        type="button"
        aria-label={task.status === "active" ? "Завершить задачу" : "Вернуть задачу"}
        aria-pressed={task.status === "completed"}
        onClick={toggleStatus}
        disabled={busy}
      >
        <span aria-hidden="true">✓</span>
      </button>

      <div className="task-copy">
        <div className="task-title-row">
          <h3>{task.title}</h3>
          <span className={`status status-${task.status}`}>
            {task.status === "completed" ? "Выполнено" : "В работе"}
          </span>
        </div>
        {task.description && <p>{task.description}</p>}
      </div>

      <div className="task-actions">
        <button
          className={`text-button ${selected ? "text-button-selected" : ""}`}
          type="button"
          onClick={() => onSelect(task.id)}
          disabled={busy || task.status === "completed"}
        >
          {selected ? "Выбрана" : "Выбрать"}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => setEditing(true)}
          disabled={busy}
        >
          Изменить
        </button>
        <button
          className="text-button text-button-danger"
          type="button"
          onClick={() => onDelete(task.id)}
          disabled={busy}
        >
          Удалить
        </button>
      </div>
    </li>
  );
}

