import { apiRequest } from "./client";
import type { Task, TaskInput, TaskUpdate } from "../types";

interface TaskResponse {
  task: Task;
}

interface TaskListResponse {
  tasks: Task[];
}

export async function getTasks(token: string): Promise<Task[]> {
  const response = await apiRequest<TaskListResponse>("/tasks", {}, token);
  return response.tasks;
}

export async function createTask(token: string, input: TaskInput): Promise<Task> {
  const response = await apiRequest<TaskResponse>(
    "/tasks",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
  return response.task;
}

export async function updateTask(
  token: string,
  taskId: number,
  input: TaskUpdate,
): Promise<Task> {
  const response = await apiRequest<TaskResponse>(
    `/tasks/${taskId}`,
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
  return response.task;
}

export function deleteTask(token: string, taskId: number): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}`, { method: "DELETE" }, token);
}

