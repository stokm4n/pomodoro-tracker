import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import { deleteTaskFromStatistics, getStatistics } from "../api/statistics";
import { useAuth } from "../context/AuthContext";
import type {
  DailyStatistics,
  SessionHistoryItem,
  Statistics,
  StatisticsPeriod,
} from "../types";

const periodLabels: Record<StatisticsPeriod, string> = {
  today: "Сегодня",
  week: "7 дней",
  all: "Всё время",
};

const chartScaleLabels: Record<StatisticsPeriod, string> = {
  today: "по 3 часа",
  week: "по дням",
  all: "по месяцам",
};

interface ChartPoint {
  key: string;
  label: string;
  focus_seconds: number;
}

interface ActivityDay {
  date: string;
  completedPomodoros: number;
  level: number;
  future: boolean;
}

interface ActivityMonth {
  label: string;
  column: number;
}

export function StatisticsOverview({ sessions }: { sessions: SessionHistoryItem[] }) {
  const { token, logout } = useAuth();
  const [period, setPeriod] = useState<StatisticsPeriod>("week");
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [activityDaily, setActivityDaily] = useState<DailyStatistics[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [deletingTaskID, setDeletingTaskID] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError("");

    getStatistics(token, period)
      .then(setStatistics)
      .catch((requestError: unknown) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          logout();
          return;
        }
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Не удалось загрузить статистику",
        );
      })
      .finally(() => setLoading(false));
  }, [token, period]);

  useEffect(() => {
    if (!token) return;
    setActivityLoading(true);

    getStatistics(token, "all")
      .then((result) => setActivityDaily(result.daily))
      .catch((requestError: unknown) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          logout();
        }
      })
      .finally(() => setActivityLoading(false));
  }, [token]);

  const chartPoints = useMemo(
    () => buildChartSeries(statistics?.daily ?? [], sessions, period),
    [statistics, sessions, period],
  );
  const maximumFocus = Math.max(...chartPoints.map((point) => point.focus_seconds), 1);
  const maximumTaskPomodoros = Math.max(
    ...(statistics?.top_tasks.map((task) => task.completed_pomodoros) ?? []),
    1,
  );

  async function permanentlyDeleteTask(taskId: number, title: string) {
    const task = statistics?.top_tasks.find((item) => item.task_id === taskId);
    const consequence = task?.deleted
      ? "Она исчезнет из рейтинга, а история сессий останется без привязки к задаче."
      : "Она исчезнет из рабочего списка и рейтинга, а история сессий останется без привязки к задаче.";
    if (
      !token
      || !window.confirm(
        `Окончательно удалить задачу «${title}»? ${consequence}`,
      )
    ) return;

    setDeletingTaskID(taskId);
    setError("");
    try {
      await deleteTaskFromStatistics(token, taskId);
      setStatistics(await getStatistics(token, period));
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        logout();
        return;
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Не удалось удалить задачу из статистики",
      );
    } finally {
      setDeletingTaskID(null);
    }
  }

  return (
    <section className="statistics-overview" aria-labelledby="statistics-title">
        {error && <p className="page-error" role="alert">{error}</p>}

        {loading && !statistics ? (
          <div className="statistics-loading">Загружаем статистику…</div>
        ) : statistics ? (
          <>
            <ActivityCalendar daily={activityDaily} loading={activityLoading} />

            <div className="statistics-overview-heading">
              <div>
                <span className="eyebrow">Основные показатели</span>
                <h2 id="statistics-title">Обзор</h2>
              </div>
              <div className="statistics-periods" aria-label="Период статистики">
                {(Object.keys(periodLabels) as StatisticsPeriod[]).map((item) => (
                  <button
                    key={item}
                    className={period === item ? "active" : ""}
                    type="button"
                    onClick={() => setPeriod(item)}
                  >
                    {periodLabels[item]}
                  </button>
                ))}
              </div>
            </div>

            <section className="statistics-summary" aria-label="Основные показатели">
              <StatisticCard label="Завершено Pomodoro" value={String(statistics.completed_pomodoros)} />
              <StatisticCard label="Время фокуса" value={formatFocusTime(statistics.focus_seconds)} />
              <StatisticCard label="Выполнено задач" value={String(statistics.completed_tasks)} />
              <StatisticCard label="Отменено сессий" value={String(statistics.cancelled_sessions)} />
            </section>

            <div className="statistics-grid">
              <section className="statistics-card chart-card" aria-labelledby="chart-title">
                <div className="statistics-card-heading">
                  <div>
                    <span className="eyebrow">Динамика</span>
                    <h2 id="chart-title">Минуты фокуса</h2>
                  </div>
                  <span>{periodLabels[period]} · {chartScaleLabels[period]}</span>
                </div>

                {chartPoints.length === 0 ? (
                  <StatisticsEmpty text="За этот период пока нет завершённых Pomodoro." />
                ) : (
                  <div className="focus-chart" aria-label="График минут фокуса">
                    {chartPoints.map((point) => {
                      const minutes = Math.floor(point.focus_seconds / 60);
                      const height = point.focus_seconds === 0
                        ? 0
                        : Math.max(6, (point.focus_seconds / maximumFocus) * 100);
                      return (
                        <div className="chart-column" key={point.key}>
                          <span className="chart-value">{minutes}</span>
                          <div className="chart-track">
                            <span style={{ height: `${height}%` }} />
                          </div>
                          <time dateTime={point.key}>{point.label}</time>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="statistics-card top-tasks-card" aria-labelledby="top-tasks-title">
                <div className="statistics-card-heading">
                  <div>
                    <span className="eyebrow">Задачи</span>
                    <h2 id="top-tasks-title">Больше всего фокуса</h2>
                  </div>
                </div>

                {statistics.top_tasks.length === 0 ? (
                  <StatisticsEmpty text="Завершите Pomodoro с выбранной задачей." />
                ) : (
                  <ol className="top-tasks-list">
                    {statistics.top_tasks.map((task, index) => (
                      <li key={task.task_id}>
                        <span className="top-task-number">{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <div className="top-task-copy">
                            <strong>{task.title}</strong>
                            <div className="top-task-actions">
                              <span>{task.completed_pomodoros} Pomodoro · {formatFocusTime(task.focus_seconds)}</span>
                              <button
                                className="top-task-delete"
                                type="button"
                                disabled={deletingTaskID === task.task_id}
                                onClick={() => permanentlyDeleteTask(task.task_id, task.title)}
                              >
                                {deletingTaskID === task.task_id ? "Удаляем…" : "Удалить"}
                              </button>
                            </div>
                          </div>
                          <div className="top-task-track" aria-hidden="true">
                            <span
                              style={{
                                width: `${(task.completed_pomodoros / maximumTaskPomodoros) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        ) : null}
    </section>
  );
}

function ActivityCalendar({
  daily,
  loading,
}: {
  daily: DailyStatistics[];
  loading: boolean;
}) {
  const { days, months } = useMemo(() => buildActivityCalendar(daily), [daily]);

  return (
    <section className="statistics-card activity-card" aria-labelledby="activity-title">
      <div className="statistics-card-heading activity-heading">
        <div>
          <span className="eyebrow">Последние 53 недели</span>
          <h2 id="activity-title">Календарь активности</h2>
        </div>
        <span>Завершённые Pomodoro по дням</span>
      </div>

      {loading ? (
        <div className="activity-loading">Загружаем активность…</div>
      ) : (
        <>
          <div className="activity-calendar-scroll">
            <div className="activity-calendar" aria-label="Календарь завершённых Pomodoro за последний год">
              <div className="activity-months" aria-hidden="true">
                {months.map((month) => (
                  <span key={`${month.label}-${month.column}`} style={{ gridColumn: month.column }}>
                    {month.label}
                  </span>
                ))}
              </div>
              <div className="activity-calendar-body">
                <div className="activity-weekdays" aria-hidden="true">
                  <span>Вс</span>
                  <span>Пн</span>
                  <span>Вт</span>
                  <span>Ср</span>
                  <span>Чт</span>
                  <span>Пт</span>
                  <span>Сб</span>
                </div>
                <div className="activity-days">
                  {days.map((day) => {
                    const label = day.future ? undefined : activityDayLabel(day);
                    return (
                      <time
                        key={day.date}
                        className={`activity-day level-${day.level}${day.future ? " is-future" : ""}`}
                        dateTime={day.date}
                        aria-label={label}
                      >
                        {label && (
                          <span className="activity-tooltip" aria-hidden="true">
                            {label}
                          </span>
                        )}
                      </time>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="activity-legend" aria-label="Шкала активности">
            <span>Меньше</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <i className={`activity-day level-${level}`} key={level} aria-hidden="true" />
            ))}
            <span>Больше</span>
          </div>
        </>
      )}
    </section>
  );
}

function StatisticCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatisticsEmpty({ text }: { text: string }) {
  return <div className="statistics-empty">{text}</div>;
}

function formatFocusTime(totalSeconds: number) {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

function buildChartSeries(
  daily: DailyStatistics[],
  sessions: SessionHistoryItem[],
  period: StatisticsPeriod,
): ChartPoint[] {
  if (period === "today") return buildHourlyRanges(sessions);
  if (period === "all") return buildMonthlySeries(daily);

  const days = 7;
  const byDate = new Map(daily.map((value) => [value.date, value]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (days - index - 1));
    const dateKey = localDateValue(date);
    return {
      key: dateKey,
      label: formatWeekday(dateKey),
      focus_seconds: byDate.get(dateKey)?.focus_seconds ?? 0,
    };
  });
}

function buildHourlyRanges(sessions: SessionHistoryItem[]): ChartPoint[] {
  const today = localDateValue(new Date());
  const ranges = Array.from({ length: 8 }, (_, index) => {
    const startHour = index * 3;
    const endHour = startHour + 3;
    return {
      key: `${today}T${String(startHour).padStart(2, "0")}:00`,
      label: `${String(startHour).padStart(2, "0")}–${String(endHour).padStart(2, "0")}`,
      focus_seconds: 0,
    };
  });

  sessions.forEach((session) => {
    const startedAt = new Date(session.started_at);
    if (
      session.status !== "completed"
      || session.session_type !== "work"
      || localDateValue(startedAt) !== today
    ) return;

    ranges[Math.floor(startedAt.getHours() / 3)].focus_seconds += session.elapsed_seconds;
  });

  return ranges;
}

function buildMonthlySeries(daily: DailyStatistics[]): ChartPoint[] {
  const byMonth = new Map<string, number>();
  daily.forEach((day) => {
    const month = day.date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + day.focus_seconds);
  });

  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(12, 0, 0, 0);

  const rollingYearStart = new Date(currentMonth);
  rollingYearStart.setMonth(rollingYearStart.getMonth() - 11);

  const firstRecordedMonth = [...byMonth.keys()].sort()[0];
  const firstRecordedDate = firstRecordedMonth
    ? new Date(`${firstRecordedMonth}-01T12:00:00`)
    : rollingYearStart;
  const start = firstRecordedDate < rollingYearStart
    ? firstRecordedDate
    : rollingYearStart;

  const points: ChartPoint[] = [];
  for (const cursor = new Date(start); cursor <= currentMonth; cursor.setMonth(cursor.getMonth() + 1)) {
    const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    points.push({
      key: month,
      label: formatMonth(month),
      focus_seconds: byMonth.get(month) ?? 0,
    });
  }

  return points;
}

function formatMonth(month: string) {
  const date = new Date(`${month}-01T12:00:00`);
  const monthName = date.toLocaleDateString("ru-RU", { month: "short" });
  return `${monthName} ${String(date.getFullYear()).slice(-2)}`;
}

function localDateValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatWeekday(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  return date.toLocaleDateString("ru-RU", { weekday: "short" });
}

function buildActivityCalendar(daily: DailyStatistics[]): {
  days: ActivityDay[];
  months: ActivityMonth[];
} {
  const byDate = new Map(daily.map((day) => [day.date, day.completed_pomodoros]));
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayValue = localDateValue(today);

  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - 52 * 7);

  const days: ActivityDay[] = [];
  const months: ActivityMonth[] = [];

  for (let week = 0; week < 53; week += 1) {
    let monthDate: Date | null = null;

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + weekday);
      const dateValue = localDateValue(date);
      const completedPomodoros = byDate.get(dateValue) ?? 0;
      const future = dateValue > todayValue;

      if (date.getDate() === 1) monthDate = date;
      days.push({
        date: dateValue,
        completedPomodoros,
        level: future ? 0 : activityLevel(completedPomodoros),
        future,
      });
    }

    if (week === 0 || monthDate) {
      const labelDate = monthDate ?? start;
      months.push({
        label: labelDate.toLocaleDateString("ru-RU", { month: "short" }),
        column: week + 1,
      });
    }
  }

  return { days, months };
}

function activityLevel(completedPomodoros: number) {
  if (completedPomodoros === 0) return 0;
  if (completedPomodoros === 1) return 1;
  if (completedPomodoros === 2) return 2;
  if (completedPomodoros <= 4) return 3;
  return 4;
}

function activityDayLabel(day: ActivityDay) {
  const date = new Date(`${day.date}T12:00:00`);
  const formattedDate = date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${formattedDate}: ${formatPomodoroCount(day.completedPomodoros)}`;
}

function formatPomodoroCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const ending = mod10 === 1 && mod100 !== 11
    ? "сессия"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? "сессии"
      : "сессий";
  return `${count} Pomodoro-${ending}`;
}
