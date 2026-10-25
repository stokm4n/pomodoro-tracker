import { useTheme } from "../context/ThemeContext";

export function ThemeToggle({ auth = false }: { auth?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const nextThemeLabel = theme === "dark" ? "светлую" : "тёмную";

  return (
    <button
      className={`theme-toggle${auth ? " theme-toggle-auth" : ""}`}
      type="button"
      onClick={toggleTheme}
      aria-label={`Включить ${nextThemeLabel} тему`}
      title={`Включить ${nextThemeLabel} тему`}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
