import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { TomatoMark } from "../components/TomatoMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";

type AuthMode = "login" | "register";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Не удалось связаться с сервером",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
  }

  return (
    <main className="auth-layout">
      <section className="auth-intro" aria-labelledby="welcome-title">
        <a className="brand brand-light" href="#top">
          <TomatoMark light />
          <span>Pomodoro Tracker</span>
        </a>

        <div className="auth-intro-copy">
          <span className="eyebrow eyebrow-light">Фокус без перегрузки</span>
          <h1 id="welcome-title">Одна задача. Один интервал. Чёткий результат.</h1>
          <p>
            Планируйте работу небольшими шагами и сохраняйте ритм, не теряя из
            виду главное.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <ThemeToggle auth />
        <div className="auth-card">
          <div className="auth-tabs" aria-label="Выбор действия">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              Вход
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => changeMode("register")}
            >
              Регистрация
            </button>
          </div>

          <div className="auth-heading">
            <span className="eyebrow">Личный кабинет</span>
            <h2>{mode === "login" ? "С возвращением" : "Создайте аккаунт"}</h2>
            <p>
              {mode === "login"
                ? "Войдите, чтобы продолжить работу со своими задачами."
                : "Придумайте логин и пароль — остальное настроим позже."}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Логин</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Введите логин"
                minLength={3}
                maxLength={50}
                autoComplete="username"
                required
              />
              <small>Латинские буквы, цифры, точка, дефис или подчёркивание.</small>
            </label>

            <label className="field">
              <span>Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Введите пароль"
                minLength={8}
                maxLength={72}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="button button-primary button-wide" disabled={submitting}>
              {submitting
                ? "Подождите…"
                : mode === "login"
                  ? "Войти"
                  : "Создать аккаунт"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

