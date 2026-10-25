import { useEffect, useState, type FormEvent } from "react";
import * as settingsApi from "../api/settings";
import { ApiError } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../context/AuthContext";
import type { AppView, NotificationSound, SettingsInput } from "../types";
import {
  getNotificationAudioContext,
  playNotificationSound,
} from "../utils/notificationSound";

interface SettingsPageProps {
  onNavigate: (view: AppView) => void;
}

type DurationField =
  | "work_duration_minutes"
  | "short_break_minutes"
  | "long_break_minutes";

interface SettingsForm {
  work_duration_minutes: string;
  short_break_minutes: string;
  long_break_minutes: string;
  notifications_enabled: boolean;
  notification_sound: NotificationSound;
  notification_volume: number;
}

const defaultSettings: SettingsForm = {
  work_duration_minutes: "25",
  short_break_minutes: "5",
  long_break_minutes: "15",
  notifications_enabled: true,
  notification_sound: "classic",
  notification_volume: 70,
};

const soundLabels: Record<NotificationSound, string> = {
  classic: "Классический",
  soft: "Мягкий",
  bell: "Колокольчик",
  digital: "Цифровой",
  people_go: "Ну че народ погнали",
};

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const { token, logout } = useAuth();
  const [form, setForm] = useState<SettingsForm>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  useEffect(() => {
    if (!token) return;

    settingsApi
      .getSettings(token)
      .then((settings) => {
        setForm({
          work_duration_minutes: String(settings.work_duration_minutes),
          short_break_minutes: String(settings.short_break_minutes),
          long_break_minutes: String(settings.long_break_minutes),
          notifications_enabled: settings.notifications_enabled,
          notification_sound: settings.notification_sound,
          notification_volume: settings.notification_volume,
        });
        if (settings.notifications_enabled) {
          setNotificationMessage(notificationStatusMessage());
        }
      })
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [token]);

  function handleError(requestError: unknown) {
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

  function setDuration(field: DurationField, value: string) {
    setSaved(false);
    setForm((current) => ({
      ...current,
      [field]: value.replace(/\D/g, ""),
    }));
  }

  async function changeNotifications(enabled: boolean) {
    setSaved(false);
    setForm((current) => ({ ...current, notifications_enabled: enabled }));

    if (!enabled) {
      setNotificationMessage("");
      return;
    }
    if (!("Notification" in window)) {
      setNotificationMessage(
        "Системные уведомления не поддерживаются. Звуковой сигнал будет работать.",
      );
      return;
    }

    try {
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      setNotificationMessage(notificationPermissionMessage(permission));
    } catch {
      setNotificationMessage(
        "Не удалось запросить разрешение. Звуковой сигнал будет работать.",
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setSaving(true);
    setSaved(false);
    setError("");

    const workDuration = Number(form.work_duration_minutes);
    const shortBreak = Number(form.short_break_minutes);
    const longBreak = Number(form.long_break_minutes);
    if (
      !form.work_duration_minutes ||
      !Number.isInteger(workDuration) ||
      workDuration < 1 ||
      workDuration > 180
    ) {
      setError("Рабочий интервал должен быть от 1 до 180 минут");
      setSaving(false);
      return;
    }
    if (
      !form.short_break_minutes ||
      !Number.isInteger(shortBreak) ||
      shortBreak < 1 ||
      shortBreak > 60
    ) {
      setError("Короткий перерыв должен быть от 1 до 60 минут");
      setSaving(false);
      return;
    }
    if (
      !form.long_break_minutes ||
      !Number.isInteger(longBreak) ||
      longBreak < 1 ||
      longBreak > 120
    ) {
      setError("Длинный перерыв должен быть от 1 до 120 минут");
      setSaving(false);
      return;
    }

    try {
      const input: SettingsInput = {
        work_duration_minutes: workDuration,
        short_break_minutes: shortBreak,
        long_break_minutes: longBreak,
        notifications_enabled: form.notifications_enabled,
        notification_sound: form.notification_sound,
        notification_volume: form.notification_volume,
      };
      const settings = await settingsApi.updateSettings(token, input);
      setForm({
        work_duration_minutes: String(settings.work_duration_minutes),
        short_break_minutes: String(settings.short_break_minutes),
        long_break_minutes: String(settings.long_break_minutes),
        notifications_enabled: settings.notifications_enabled,
        notification_sound: settings.notification_sound,
        notification_volume: settings.notification_volume,
      });
      setSaved(true);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setSaving(false);
    }
  }

  function previewSound() {
    setError("");
    try {
      const audioContext = getNotificationAudioContext();
      void playNotificationSound(
        audioContext,
        form.notification_sound,
        form.notification_volume,
      ).catch(() => setError("Браузер не разрешил воспроизвести звук"));
    } catch {
      setError("Браузер не поддерживает предпрослушивание звука");
    }
  }

  return (
    <div className="app-shell" id="top">
      <AppHeader currentView="settings" onNavigate={onNavigate} />

      <main className="settings-page">
        <section className="dashboard-intro settings-intro">
          <div>
            <span className="eyebrow">Персональный ритм</span>
            <h1>Настройки</h1>
            <p>Задайте продолжительность работы и перерывов.</p>
          </div>
        </section>

        {error && <p className="page-error" role="alert">{error}</p>}

        <form className="settings-card" onSubmit={submit}>
          <div className="settings-card-heading">
            <div>
              <span className="eyebrow">Интервалы</span>
              <h2>Продолжительность</h2>
            </div>
            <div className="settings-preview" aria-label="Предпросмотр рабочего интервала">
              {form.work_duration_minutes || "—"}:00
            </div>
          </div>

          {loading ? (
            <div className="empty-state settings-loading">Загружаем настройки…</div>
          ) : (
            <>
              <div className="duration-grid">
                <label className="duration-field">
                  <span>Работа</span>
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      value={form.work_duration_minutes}
                      onChange={(event) =>
                        setDuration("work_duration_minutes", event.target.value)
                      }
                      required
                    />
                    <small>мин</small>
                  </div>
                  <p>Основной сфокусированный интервал</p>
                </label>

                <label className="duration-field">
                  <span>Короткий перерыв</span>
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={form.short_break_minutes}
                      onChange={(event) =>
                        setDuration("short_break_minutes", event.target.value)
                      }
                      required
                    />
                    <small>мин</small>
                  </div>
                  <p>Отдых между рабочими интервалами</p>
                </label>

                <label className="duration-field">
                  <span>Длинный перерыв</span>
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      value={form.long_break_minutes}
                      onChange={(event) =>
                        setDuration("long_break_minutes", event.target.value)
                      }
                      required
                    />
                    <small>мин</small>
                  </div>
                  <p>Отдых после четырёх Pomodoro</p>
                </label>
              </div>

              <label className="notification-setting">
                <div>
                  <strong>Уведомления</strong>
                  <span>Сообщать о завершении рабочего интервала и перерыва</span>
                </div>
                <input
                  type="checkbox"
                  checked={form.notifications_enabled}
                  onChange={(event) => void changeNotifications(event.target.checked)}
                />
              </label>

              {form.notifications_enabled && notificationMessage && (
                <p className="notification-status" role="status">
                  {notificationMessage}
                </p>
              )}

              <section className="sound-settings" aria-labelledby="sound-settings-title">
                <div className="sound-settings-heading">
                  <div>
                    <strong id="sound-settings-title">Звуковой сигнал</strong>
                    <span>Выберите звук завершения интервала и его громкость</span>
                  </div>
                  <button
                    className="button button-quiet button-small"
                    type="button"
                    onClick={previewSound}
                  >
                    Прослушать
                  </button>
                </div>

                <div className="sound-controls">
                  <label className="sound-select">
                    <span>Сигнал</span>
                    <select
                      value={form.notification_sound}
                      onChange={(event) => {
                        setSaved(false);
                        setForm((current) => ({
                          ...current,
                          notification_sound: event.target.value as NotificationSound,
                        }));
                      }}
                    >
                      {(Object.keys(soundLabels) as NotificationSound[]).map((sound) => (
                        <option key={sound} value={sound}>{soundLabels[sound]}</option>
                      ))}
                    </select>
                  </label>

                  <label className="sound-volume">
                    <span>Громкость</span>
                    <div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={form.notification_volume}
                        onChange={(event) => {
                          setSaved(false);
                          setForm((current) => ({
                            ...current,
                            notification_volume: Number(event.target.value),
                          }));
                        }}
                      />
                      <output>{form.notification_volume}%</output>
                    </div>
                  </label>
                </div>
              </section>

              <div className="settings-actions">
                <button className="button button-primary" disabled={saving}>
                  {saving ? "Сохраняем…" : "Сохранить настройки"}
                </button>
                {saved && <span className="save-success">Настройки сохранены</span>}
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  );
}

function notificationStatusMessage() {
  if (!("Notification" in window)) {
    return "Системные уведомления не поддерживаются. Звуковой сигнал будет работать.";
  }
  return notificationPermissionMessage(Notification.permission);
}

function notificationPermissionMessage(permission: NotificationPermission) {
  if (permission === "granted") {
    return "";
  }
  if (permission === "denied") {
    return "Системные уведомления запрещены в браузере. Звуковой сигнал останется доступен.";
  }
  return "При включении браузер запросит разрешение на системные уведомления.";
}

