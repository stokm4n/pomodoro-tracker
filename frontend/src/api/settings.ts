import { apiRequest } from "./client";
import type { Settings, SettingsInput } from "../types";

interface SettingsResponse {
  settings: Settings;
}

export async function getSettings(token: string): Promise<Settings> {
  const response = await apiRequest<SettingsResponse>("/settings", {}, token);
  return response.settings;
}

export async function updateSettings(
  token: string,
  input: SettingsInput,
): Promise<Settings> {
  const response = await apiRequest<SettingsResponse>(
    "/settings",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
  return response.settings;
}

