import { useState, type FormEvent } from "react";
import type { TaskInput } from "../types";

interface TaskFormProps {
  submitting: boolean;
  onSubmit: (input: TaskInput) => Promise<void>;
}

export function TaskForm({ submitting, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onSubmit({ title, description });
      setTitle("");
      setDescription("");
    } catch {
      // The page displays the API error and keeps the form values for correction.
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Новая задача</span>
          <h2>Что нужно сделать?</h2>
        </div>
      </div>

      <label className="field">
        <span>Название</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Например, подготовить раздел курсовой"
          maxLength={200}
          required
        />
      </label>

      <label className="field">
        <span>Описание</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Необязательно — добавьте детали или ожидаемый результат"
          maxLength={5000}
          rows={4}
        />
      </label>

      <button className="button button-primary" type="submit" disabled={submitting}>
        {submitting ? "Добавляем…" : "Добавить задачу"}
      </button>
    </form>
  );
}

