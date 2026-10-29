import { useEffect, useMemo, useRef, useState } from "react";
import * as sessionsApi from "../api/sessions";
import * as settingsApi from "../api/settings";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLofiPlayer } from "../context/LofiPlayerContext";
import type {
  BreakActivity,
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
  selectedTaskTitle: string | null;
  onSelectTask: (taskId: number | null) => void;
}

const sessionLabels: Record<SessionType, string> = {
  work: "Работа",
  short_break: "Короткий перерыв",
  long_break: "Длинный перерыв",
};

const breakActivityOptions: Array<{
  id: BreakActivity;
  emoji: string;
  label: string;
  minimumMinutes: number;
}> = [
  { id: "water", emoji: "💧", label: "Вода", minimumMinutes: 1 },
  { id: "eyes", emoji: "👀", label: "Отдых для глаз", minimumMinutes: 1 },
  { id: "music", emoji: "🎵", label: "Музыка", minimumMinutes: 2 },
  { id: "stretch", emoji: "🧘", label: "Разминка", minimumMinutes: 4 },
  { id: "walk", emoji: "🚶", label: "Прогулка", minimumMinutes: 10 },
  { id: "meal", emoji: "🍽️", label: "Приём пищи", minimumMinutes: 20 },
];

export function TimerPanel({
  selectedTaskId,
  selectedTaskTitle,
  onSelectTask,
}: TimerPanelProps) {
  const { token, logout } = useAuth();
  const { isOpen: lofiOpen, toggle: toggleLofi } = useLofiPlayer();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>("work");
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deepFocusActive, setDeepFocusActive] = useState(false);
  const [breakPlan, setBreakPlan] = useState<{
    sessionType: "short_break" | "long_break";
    durationMinutes: number;
  } | null>(null);
  const [selectedBreakActivities, setSelectedBreakActivities] = useState<BreakActivity[]>([]);
  const [pendingBreakPlan, setPendingBreakPlan] = useState<{
    sessionType: "short_break" | "long_break";
    activities: BreakActivity[];
  } | null>(null);
  const [readinessSessionID, setReadinessSessionID] = useState<number | null>(null);
  const [readinessSaving, setReadinessSaving] = useState(false);
  const autoCompleting = useRef(false);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

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
          handleCompletedSession(completion);
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

  useEffect(() => {
    if (!session) return;
    const warnAboutActiveSession = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnAboutActiveSession);
    return () => window.removeEventListener("beforeunload", warnAboutActiveSession);
  }, [session?.id]);

  useEffect(() => {
    if (!deepFocusActive) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const restoreWakeLock = () => {
      if (document.visibilityState === "visible") void requestScreenWakeLock();
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setDeepFocusActive(false);
    };

    document.addEventListener("visibilitychange", restoreWakeLock);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("visibilitychange", restoreWakeLock);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      void releaseScreenWakeLock();
    };
  }, [deepFocusActive]);

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

  function notifyAboutCompletion(completion: sessionsApi.SessionCompletionResponse) {
    if (!settings?.notifications_enabled) return;

    playCompletionSound();
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const nextType = completion.next_session_type;
    const completedWorkEarly = completion.session.session_type === "work"
      && completion.session.elapsed_seconds < completion.session.planned_duration_seconds;
    const isBreak = nextType !== "work";
    const title = completedWorkEarly
      ? "Фокус-сессия завершена"
      : isBreak ? "Pomodoro завершён" : "Перерыв завершён";
    const body = completedWorkEarly
      ? "Время фокуса учтено, но Pomodoro не засчитан."
      : nextType === "long_break"
      ? "Четыре Pomodoro готовы — время длинного перерыва."
      : nextType === "short_break"
        ? "Время короткого перерыва."
        : "Можно вернуться к работе.";
    try {
      new Notification(title, { body, tag: "pomodoro-timer-completed" });
    } catch {
      // Таймер всё равно переключится на следующий интервал.
    }
  }

  function prepareNextInterval(nextType: SessionType) {
    setSession(null);
    setSessionType(nextType);
  }

  function handleCompletedSession(completion: sessionsApi.SessionCompletionResponse) {
    prepareNextInterval(completion.next_session_type);
    notifyAboutCompletion(completion);

    if (completion.session.session_type === "work" && completion.next_session_type !== "work") {
      const durationMinutes = completion.next_session_type === "long_break"
        ? settings?.long_break_minutes ?? 15
        : settings?.short_break_minutes ?? 5;
      setSelectedBreakActivities([]);
      setBreakPlan({
        sessionType: completion.next_session_type,
        durationMinutes,
      });
    } else if (completion.session.session_type !== "work") {
      setReadinessSessionID(completion.session.id);
    }
  }

  function toggleBreakActivity(activity: BreakActivity) {
    setSelectedBreakActivities((selected) => selected.includes(activity)
      ? selected.filter((item) => item !== activity)
      : [...selected, activity]);
  }

  async function finishBreakPlanning(skip = false) {
    if (!token || !breakPlan) return;
    const plan = {
      sessionType: breakPlan.sessionType,
      activities: skip ? [] : selectedBreakActivities,
    };
    setPendingBreakPlan(plan);
    setBreakPlan(null);
    setSessionType(plan.sessionType);
    setBusy(true);
    setError("");
    try {
      const created = await createSession(plan.sessionType, plan.activities);
      applyStartedSession(created);
      setPendingBreakPlan(null);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function continueAfterBreak(score: number | null) {
    if (!token || readinessSessionID === null) return;
    setReadinessSaving(true);
    setBusy(true);
    setError("");
    try {
      if (score !== null) {
        await sessionsApi.saveReadiness(token, readinessSessionID, score);
      }
      setReadinessSessionID(null);
      setSessionType("work");
      const created = await createSession("work", []);
      applyStartedSession(created);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setReadinessSaving(false);
      setBusy(false);
    }
  }

  async function createSession(type: SessionType, breakActivities: BreakActivity[]) {
    if (!token) throw new Error("missing authentication token");

    prepareCompletionSound();
    if (
      settings?.notifications_enabled &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      await Notification.requestPermission();
    }

    const input = {
      session_type: type,
      task_id: type === "work" ? selectedTaskId : null,
      break_activities: type === "work" ? [] : breakActivities,
    };
    try {
      return await sessionsApi.startSession(token, input);
    } catch (requestError) {
      if (
        type === "work"
        && input.task_id !== null
        && requestError instanceof ApiError
        && requestError.message === "active task not found"
      ) {
        onSelectTask(null);
        return sessionsApi.startSession(token, { ...input, task_id: null });
      }
      throw requestError;
    }
  }

  function applyStartedSession(created: PomodoroSession) {
    setSessionType(created.session_type);
    setSession(created);
    setRemainingSeconds(created.remaining_seconds);
  }

  async function start() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const activities = sessionType !== "work" && pendingBreakPlan?.sessionType === sessionType
        ? pendingBreakPlan.activities
        : [];
      const created = await createSession(sessionType, activities);
      applyStartedSession(created);
      if (sessionType !== "work") setPendingBreakPlan(null);
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
      handleCompletedSession(completion);
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
      leaveDeepFocus();
      setSession(null);
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setBusy(false);
    }
  }

  function enterDeepFocus() {
    setDeepFocusActive(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
    void requestScreenWakeLock();
  }

  function leaveDeepFocus() {
    setDeepFocusActive(false);
    void releaseScreenWakeLock();
    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }

  async function requestScreenWakeLock() {
    if (wakeLock.current) return;
    try {
      wakeLock.current = await navigator.wakeLock.request("screen");
    } catch {
      // Режим продолжит работать, даже если браузер не поддерживает Wake Lock.
    }
  }

  async function releaseScreenWakeLock() {
    const activeWakeLock = wakeLock.current;
    wakeLock.current = null;
    if (!activeWakeLock) return;
    await activeWakeLock.release().catch(() => undefined);
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
                    onClick={() => setSessionType(type)}
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

              <div className="focus-tools">
                <button
                  className="text-button deep-focus-trigger"
                  type="button"
                  onClick={enterDeepFocus}
                >
                  Глубокий фокус
                </button>
                <span aria-hidden="true">·</span>
                <button
                  className="text-button lofi-trigger"
                  type="button"
                  aria-expanded={lofiOpen}
                  onClick={toggleLofi}
                >
                  Lo-fi музыка
                </button>
              </div>

            </>
          )}

      {deepFocusActive && (
        <div className="deep-focus-overlay" role="dialog" aria-modal="true" aria-label="Глубокий фокус">
          <div className="deep-focus-content">
            <span className="deep-focus-eyebrow">Глубокий фокус</span>
            <p className="deep-focus-task">
              {(session?.session_type ?? sessionType) === "work"
                ? selectedTaskTitle ?? "Сессия без задачи"
                : sessionLabels[session?.session_type ?? sessionType]}
            </p>
            <strong className="deep-focus-time" aria-live="polite">{timerText}</strong>
            <span className="deep-focus-status">
              {session?.status === "paused"
                ? "На паузе"
                : session
                  ? sessionLabels[session.session_type]
                  : "Готов к запуску"}
            </span>
            <div className="deep-focus-controls">
              {!session ? (
                <button className="button button-primary" disabled={busy} onClick={start}>
                  {busy ? "Запускаем…" : "Начать"}
                </button>
              ) : (
                <>
                  <button className="button button-primary" disabled={busy} onClick={pauseOrResume}>
                    {session.status === "running" ? "Пауза" : "Продолжить"}
                  </button>
                  <button className="button button-quiet" disabled={busy} onClick={finish}>
                    Завершить
                  </button>
                </>
              )}
              <button className="text-button" type="button" onClick={leaveDeepFocus}>
                Выйти из режима
              </button>
            </div>
          </div>
          <p className="deep-focus-reminder">
            Не забудьте включить «Не беспокоить» на этом и ближайших устройствах.
          </p>
        </div>
      )}

      {breakPlan && (
        <div className="break-dialog-backdrop" role="presentation">
          <section className="break-dialog" role="dialog" aria-modal="true" aria-labelledby="break-plan-title">
            <span className="eyebrow">Перерыв · {breakPlan.durationMinutes} мин</span>
            <h2 id="break-plan-title">Как планируете отдохнуть?</h2>
            <p>Можно выбрать несколько вариантов.</p>
            <div className="break-activity-options">
              {breakActivityOptions
                .filter((activity) => breakPlan.durationMinutes >= activity.minimumMinutes)
                .map((activity) => {
                  const selected = selectedBreakActivities.includes(activity.id);
                  return (
                    <button
                      key={activity.id}
                      className={selected ? "is-selected" : ""}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleBreakActivity(activity.id)}
                    >
                      <span aria-hidden="true">{activity.emoji}</span>
                      <strong>{activity.label}</strong>
                      <i aria-hidden="true">✓</i>
                    </button>
                  );
                })}
            </div>
            <div className="break-dialog-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={busy}
                onClick={() => finishBreakPlanning()}
              >
                {busy ? "Запускаем…" : "Начать перерыв"}
              </button>
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => finishBreakPlanning(true)}
              >
                Пропустить и начать перерыв
              </button>
            </div>
          </section>
        </div>
      )}

      {readinessSessionID !== null && (
        <div className="break-dialog-backdrop" role="presentation">
          <section className="break-dialog readiness-dialog" role="dialog" aria-modal="true" aria-labelledby="readiness-title">
            <span className="eyebrow">Перерыв завершён</span>
            <h2 id="readiness-title">Насколько вы готовы продолжить работу?</h2>
            <p>1 — нужен дополнительный отдых, 10 — полностью готовы.</p>
            <div className="readiness-scale" aria-label="Оценка готовности от 1 до 10">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                <button
                  key={score}
                  type="button"
                  disabled={readinessSaving}
                  aria-label={`Готовность ${score} из 10`}
                  onClick={() => continueAfterBreak(score)}
                >
                  {score}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              type="button"
              disabled={readinessSaving}
              onClick={() => continueAfterBreak(null)}
            >
              Пропустить и начать работу
            </button>
          </section>
        </div>
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
    case "invalid break activity for this break duration":
      return "Один из выбранных видов отдыха не подходит для длительности перерыва.";
    case "readiness score must be between 1 and 10":
      return "Оценка готовности должна быть от 1 до 10.";
    default:
      return message;
  }
}
