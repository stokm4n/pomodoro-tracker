import { useEffect, useMemo, useRef, useState } from "react";
import * as sessionsApi from "../api/sessions";
import * as settingsApi from "../api/settings";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type {
  PomodoroSession,
  SessionType,
  Settings,
} from "../types";
import {
  getNotificationAudioContext,
  playNotificationSound,
} from "../utils/notificationSound";

interface TimerPanelProps {
  selectedTaskId: number | null;
  onSelectTask: (taskId: number | null) => void;
}

const sessionLabels: Record<SessionType, string> = {
  work: "Работа",
  short_break: "Короткий перерыв",
  long_break: "Длинный перерыв",
};

export function TimerPanel({
  selectedTaskId,
  onSelectTask,
}: TimerPanelProps) {
  const { token, logout } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>("work");
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transitionMessage, setTransitionMessage] = useState("");
  const autoCompleting = useRef(false);

  useEffect(() => {
    if (!token) return;

    Promise.all([
      settingsApi.getSettings(token),
      sessionsApi.getCurrentSession(token).catch((requestError) => {
        if (requestError instanceof ApiError && requestError.status === 404) return null;
        throw requestError;
      }),
    ])
      .then(([loadedSettings, currentSession]) => {
        setSettings(loadedSettings);
        if (currentSession) {
          setSession(currentSession);
          setSessionType(currentSession.session_type);
          setRemainingSeconds(currentSession.remaining_seconds);
          if (currentSession.session_type === "work") {
            onSelectTask(currentSession.task_id);
          }
        }
      })
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [token]);

  const configuredSeconds = useMemo(() => {
    if (!settings) return 0;
    if (sessionType === "work") return settings.work_duration_minutes * 60;
    if (sessionType === "short_break") return settings.short_break_minutes * 60;
    return settings.long_break_minutes * 60;
  }, [settings, sessionType]);

  useEffect(() => {
    if (!session) setRemainingSeconds(configuredSeconds);
  }, [configuredSeconds, session]);

  useEffect(() => {
    if (
      !session ||
      !settings?.notifications_enabled ||
      settings.notification_volume === 0
    ) return;

    const unlockSound = () => {
      prepareCompletionSound();
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("keydown", unlockSound);
    };

    window.addEventListener("pointerdown", unlockSound, { once: true });
    window.addEventListener("keydown", unlockSound, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("keydown", unlockSound);
    };
  }, [session?.id, settings?.notifications_enabled, settings?.notification_volume]);

  useEffect(() => {
    if (!session || session.status !== "running" || !token) return;

    const sessionID = session.id;
    const finishAt = Date.now() + session.remaining_seconds * 1000;
    autoCompleting.current = false;

    let timer: number | undefined;
    const tickStream = new EventSource("/api/timer/ticks");

    const updateTimer = () => {
      const next = Math.max(0, Math.ceil((finishAt - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next > 0 || autoCompleting.current) return;

      autoCompleting.current = true;
      if (timer !== undefined) window.clearInterval(timer);
      setBusy(true);
      sessionsApi
        .completeSession(token, sessionID)
        .then((completion) => {
          prepareNextInterval(completion.next_session_type);
          notifyAboutCompletion(completion.next_session_type);
        })
        .catch(handleError)
        .finally(() => setBusy(false));
    };

    timer = window.setInterval(updateTimer, 1000);
    tickStream.addEventListener("message", updateTimer);
    document.addEventListener("visibilitychange", updateTimer);
    window.addEventListener("focus", updateTimer);
    window.addEventListener("pageshow", updateTimer);
    updateTimer();

    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      tickStream.removeEventListener("message", updateTimer);
      tickStream.close();
      document.removeEventListener("visibilitychange", updateTimer);
      window.removeEventListener("focus", updateTimer);
      window.removeEventListener("pageshow", updateTimer);
    };
  }, [session?.id, session?.status, session?.remaining_seconds, token]);

  function handleError(requestError: unknown) {
    if (requestError instanceof ApiError && requestError.status === 401) {
      logout();
      return;
    }
    setError(
      requestError instanceof ApiError
        ? translateSessionError(requestError.message)
        : "Не удалось связаться с сервером",
    );
  }

  function prepareCompletionSound() {
    if (!settings?.notifications_enabled || settings.notification_volume === 0) return;
    try {
      const context = getNotificationAudioContext();
      if (context.state === "suspended") {
        void context.resume().catch(() => undefined);
      }
    } catch {
      // Таймер продолжит работать, даже если браузер не поддерживает Web Audio.
    }
  }

  function playCompletionSound() {
    if (!settings) return;
    try {
      const context = getNotificationAudioContext();
      void playNotificationSound(
        context,
        settings.notification_sound,
        settings.notification_volume,
      ).catch(() => undefined);
    } catch {
      // Системное уведомление и сообщение в интерфейсе продолжат работать.
    }
  }

  function notifyAboutCompletion(nextType: SessionType) {
    if (!settings?.notifications_enabled) return;

    playCompletionSound();
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const isBreak = nextType !== "work";
    const title = isBreak ? "Pomodoro завершён" : "Перерыв завершён";
    const body = nextType === "long_break"
      ? "Четыре Pomodoro готовы — время длинного перерыва."
      : nextType === "short_break"
        ? "Время короткого перерыва."
        : "Можно вернуться к работе.";
    try {
      new Notification(title, { body, tag: "pomodoro-timer-completed" });
    } catch {
      // Встроенное сообщение о переходе всё равно останется на странице.
    }
  }

  function prepareNextInterval(nextType: SessionType) {
    setSession(null);
    setSessionType(nextType);
    setTransitionMessage(
      nextType === "long_break"
        ? "Четыре Pomodoro завершены — время длинного перерыва."
        : nextType === "short_break"
          ? "Pomodoro завершён — время короткого перерыва."
          : "Перерыв завершён — можно вернуться к работе.",
    );
  }

  async function start() {
    if (!token) return;
    setBusy(true);
    setError("");
    setTransitionMessage("");
    try {
      prepareCompletionSound();
      if (
        settings?.notifications_enabled &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        await Notification.requestPermission();
      }
      const created = await sessionsApi.startSession(token, {
        session_type: sessionType,
        task_id: sessionType === "work" ? selectedTaskId : null,
      });
      setSession(created);
      setRemainingSeconds(created.remaining_seconds);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function pauseOrResume() {
    if (!token || !session) return;
    setBusy(true);
    setError("");
    try {
      const updated = session.status === "running"
        ? await sessionsApi.pauseSession(token, session.id)
        : await sessionsApi.resumeSession(token, session.id);
      setSession(updated);
      setRemainingSeconds(updated.remaining_seconds);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!token || !session) return;
    setBusy(true);
    setError("");
    try {
      prepareCompletionSound();
      const completion = await sessionsApi.completeSession(token, session.id);
      prepareNextInterval(completion.next_session_type);
      notifyAboutCompletion(completion.next_session_type);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!token || !session || !window.confirm("Отменить текущий интервал?")) return;
    setBusy(true);
    setError("");
    try {
      await sessionsApi.cancelSession(token, session.id);
      setSession(null);
      setTransitionMessage("");
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusy(false);
    }
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timerText = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  useEffect(() => {
    if (!session) {
      document.title = "Pomodoro Tracker";
      return;
    }

    const pauseLabel = session.status === "paused" ? " — Пауза" : "";
    document.title = `${timerText} — ${sessionLabels[session.session_type]}${pauseLabel}`;
  }, [session, timerText]);

  useEffect(() => {
    return () => {
      document.title = "Pomodoro Tracker";
    };
  }, []);

  return (
    <section className="timer-card timer-card-embedded" aria-label="Pomodoro-таймер">
      <div className="timer-panel-heading">
        <span className="eyebrow">Фокус-сессия</span>
        <h2>Таймер</h2>
      </div>

      {error && <p className="page-error timer-error" role="alert">{error}</p>}
      {transitionMessage && (
        <p className="timer-transition" role="status">{transitionMessage}</p>
      )}

          {loading ? (
            <div className="empty-state timer-loading">Загружаем таймер…</div>
          ) : (
            <>
              <div className="timer-types" aria-label="Тип интервала">
                {(Object.keys(sessionLabels) as SessionType[]).map((type) => (
                  <button
                    key={type}
                    className={sessionType === type ? "active" : ""}
                    type="button"
                    disabled={Boolean(session)}
                    onClick={() => {
                      setSessionType(type);
                      setTransitionMessage("");
                    }}
                  >
                    {sessionLabels[type]}
                  </button>
                ))}
              </div>

              <div className={`timer-clock ${session?.status === "running" ? "is-running" : ""}`}>
                <span className="timer-state">
                  {session?.status === "running"
                    ? "Идёт отсчёт"
                    : session?.status === "paused"
                      ? "На паузе"
                      : "Готов к запуску"}
                </span>
                <strong aria-live="polite">{timerText}</strong>
                <span>{sessionLabels[session?.session_type ?? sessionType]}</span>
              </div>

              <div className="timer-controls">
                {!session ? (
                  <button className="button button-primary timer-main-button" disabled={busy} onClick={start}>
                    {busy ? "Запускаем…" : "Начать"}
                  </button>
                ) : (
                  <>
                    <button className="button button-primary timer-main-button" disabled={busy} onClick={pauseOrResume}>
                      {session.status === "running" ? "Пауза" : "Продолжить"}
                    </button>
                    <button className="button button-quiet" disabled={busy} onClick={finish}>
                      Завершить
                    </button>
                    <button className="text-button text-button-danger" disabled={busy} onClick={cancel}>
                      Отменить
                    </button>
                  </>
                )}
              </div>

            </>
          )}
    </section>
  );
}

function translateSessionError(message: string) {
  switch (message) {
    case "active task not found":
      return "Выбранная задача больше недоступна. Запустите сессию ещё раз без задачи.";
    case "finish the current timer before starting another one":
      return "Сначала завершите или отмените текущий таймер.";
    case "active session not found":
      return "Активная сессия не найдена.";
    case "timer cannot perform this action in its current state":
      return "Это действие недоступно для текущего состояния таймера.";
    case "session type must be 'work', 'short_break' or 'long_break'":
      return "Выбран неизвестный тип интервала.";
    default:
      return message;
  }
}
