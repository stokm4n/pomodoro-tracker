import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { ApiError } from "../api/client";
import { Achievements } from "../components/Achievements";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../context/AuthContext";
import type { AppView } from "../types";

interface ProfilePageProps {
  onNavigate: (view: AppView) => void;
}

type ProfileSection = "profile" | "achievements" | "privacy";

export function ProfilePage({ onNavigate }: ProfilePageProps) {
  const {
    user,
    updateProfile,
    updateProfileDetails,
    updateProfilePrivacy,
    refreshProfile,
    logout,
  } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarData, setAvatarData] = useState(user?.avatar_data ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [leaderboardVisible, setLeaderboardVisible] = useState(
    user?.leaderboard_visible ?? false,
  );
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [detailsMessage, setDetailsMessage] = useState("");
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<ProfileSection>("profile");

  useEffect(() => {
    setUsername(user?.username ?? "");
  }, [user?.username]);

  useEffect(() => {
    setBio(user?.bio ?? "");
    setAvatarData(user?.avatar_data ?? "");
  }, [user?.bio, user?.avatar_data]);

  useEffect(() => {
    setLeaderboardVisible(user?.leaderboard_visible ?? false);
  }, [user?.leaderboard_visible]);

  useEffect(() => {
    void refreshProfile().catch(handleError);
  }, []);

  function handleError(requestError: unknown) {
    if (requestError instanceof ApiError && requestError.status === 401) {
      setError(
        requestError.message === "current password is incorrect"
          ? "Текущий пароль указан неверно"
          : "Не удалось подтвердить пользователя",
      );
      return;
    }
    setError(
      requestError instanceof ApiError
        ? translateProfileError(requestError.message)
        : "Не удалось связаться с сервером",
    );
  }

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setUsernameMessage("");
    setSavingUsername(true);
    try {
      await updateProfile({ username });
      setUsernameMessage("Логин изменён");
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setSavingUsername(false);
    }
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setDetailsMessage("");
    try {
      setAvatarData(await resizeAvatar(file));
    } catch (avatarError) {
      setError(
        avatarError instanceof Error
          ? avatarError.message
          : "Не удалось обработать изображение",
      );
    }
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDetailsMessage("");
    setSavingDetails(true);
    try {
      await updateProfileDetails({ bio, avatar_data: avatarData });
      setDetailsMessage("Профиль обновлён");
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setSavingDetails(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPasswordMessage("");
    if (newPassword.length < 8 || newPassword.length > 72) {
      setError("Новый пароль должен содержать от 8 до 72 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Новые пароли не совпадают");
      return;
    }

    setSavingPassword(true);
    try {
      await updateProfile({
        username: user?.username ?? username,
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Пароль изменён");
    } catch (requestError) {
      handleError(requestError);
    } finally {
      setSavingPassword(false);
    }
  }

  async function changeLeaderboardVisibility(visible: boolean) {
    const previousValue = leaderboardVisible;
    setError("");
    setLeaderboardVisible(visible);
    setSavingPrivacy(true);
    try {
      await updateProfilePrivacy({ leaderboard_visible: visible });
    } catch (requestError) {
      setLeaderboardVisible(previousValue);
      handleError(requestError);
    } finally {
      setSavingPrivacy(false);
    }
  }

  return (
    <div className="app-shell" id="top">
      <AppHeader currentView="profile" onNavigate={onNavigate} />

      <main className="profile-page">
        <section className="dashboard-intro profile-intro">
          <div>
            <span className="eyebrow">Учётная запись</span>
            <h1>Профиль</h1>
            <p>Изменяйте данные для входа и просматривайте информацию об аккаунте.</p>
          </div>
        </section>

        {error && <p className="page-error" role="alert">{error}</p>}

        <div className="profile-grid">
          <aside className="profile-summary-card">
            <span className="profile-avatar" aria-hidden="true">
              {user?.avatar_data ? (
                <img src={user.avatar_data} alt="" />
              ) : (
                user?.username.charAt(0).toUpperCase()
              )}
            </span>
            <div>
              <span className="eyebrow">Пользователь</span>
              <h2>{user?.username}</h2>
              {user?.bio && <p className="profile-bio-summary">{user.bio}</p>}
            </div>
            <dl className="profile-details">
              <div>
                <dt>Роль</dt>
                <dd>{user?.role === "admin" ? "Администратор" : "Пользователь"}</dd>
              </div>
              <div>
                <dt>Дата регистрации</dt>
                <dd>{formatRegistrationDate(user?.created_at)}</dd>
              </div>
            </dl>
            <button className="button button-quiet profile-logout" type="button" onClick={logout}>
              Выйти из аккаунта
            </button>
          </aside>

          <div className="profile-workspace">
            <nav className="profile-section-tabs" aria-label="Разделы профиля">
              <button
                className={activeSection === "profile" ? "active" : ""}
                type="button"
                onClick={() => {
                  setActiveSection("profile");
                  setError("");
                }}
              >
                <span>Профиль</span>
                <small>Фото, описание и рейтинг</small>
              </button>
              <button
                className={activeSection === "achievements" ? "active" : ""}
                type="button"
                onClick={() => {
                  setActiveSection("achievements");
                  setError("");
                }}
              >
                <span>Достижения</span>
                <small>Награды и прогресс</small>
              </button>
              <button
                className={activeSection === "privacy" ? "active" : ""}
                type="button"
                onClick={() => {
                  setActiveSection("privacy");
                  setError("");
                }}
              >
                <span>Конфиденциальность</span>
                <small>Логин, пароль и безопасность</small>
              </button>
            </nav>

            <div className="profile-forms">
              {activeSection === "profile" ? (
                <>
            <form className="profile-card" onSubmit={saveDetails}>
              <div className="profile-card-heading">
                <span className="eyebrow">О себе</span>
                <h2>Фото и описание</h2>
              </div>

              <div className="profile-details-editor">
                <div className="profile-avatar-actions">
                  <label className="button button-quiet button-small avatar-upload-button">
                    Выбрать фото для аватара
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={chooseAvatar}
                    />
                  </label>
                  {avatarData && (
                    <button
                      className="text-button text-button-danger"
                      type="button"
                      onClick={() => {
                        setAvatarData("");
                        setDetailsMessage("");
                      }}
                    >
                      Удалить фото
                    </button>
                  )}
                  <small>JPG, PNG или WebP. Фото автоматически уменьшится.</small>
                </div>

                <label className="profile-field">
                  <span>Описание</span>
                  <textarea
                    value={bio}
                    maxLength={500}
                    rows={5}
                    placeholder="Расскажите немного о себе"
                    onChange={(event) => {
                      setBio(event.target.value);
                      setDetailsMessage("");
                    }}
                  />
                  <small>{bio.length} из 500 символов</small>
                </label>
              </div>

              <div className="profile-actions">
                <button className="button button-primary" disabled={savingDetails}>
                  {savingDetails ? "Сохраняем…" : "Сохранить профиль"}
                </button>
                {detailsMessage && <span className="save-success">{detailsMessage}</span>}
              </div>
            </form>

            <section className="profile-card">
              <div className="profile-card-heading">
                <span className="eyebrow">Публичный профиль</span>
                <h2>Участие в рейтинге</h2>
              </div>
              <label className="profile-privacy-setting">
                <div>
                  <strong>Показывать меня в leaderboard</strong>
                  <span>
                    Другие пользователи увидят логин, аватар, описание, число
                    Pomodoro и общее время фокуса.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={leaderboardVisible}
                  disabled={savingPrivacy}
                  onChange={(event) => void changeLeaderboardVisibility(event.target.checked)}
                />
              </label>
            </section>

                </>
              ) : activeSection === "achievements" ? (
                <Achievements />
              ) : (
                <>
            <form className="profile-card" onSubmit={saveUsername}>
              <div className="profile-card-heading">
                <span className="eyebrow">Данные для входа</span>
                <h2>Изменить логин</h2>
              </div>
              <label className="profile-field">
                <span>Логин</span>
                <input
                  value={username}
                  minLength={3}
                  maxLength={50}
                  pattern="[A-Za-z0-9._-]+"
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setUsernameMessage("");
                  }}
                  required
                />
                <small>Латинские буквы, цифры, точка, дефис или подчёркивание</small>
              </label>
              <div className="profile-actions">
                <button className="button button-primary" disabled={savingUsername}>
                  {savingUsername ? "Сохраняем…" : "Сохранить логин"}
                </button>
                {usernameMessage && <span className="save-success">{usernameMessage}</span>}
              </div>
            </form>

            <form className="profile-card" onSubmit={savePassword}>
              <div className="profile-card-heading">
                <span className="eyebrow">Безопасность</span>
                <h2>Изменить пароль</h2>
              </div>
              <div className="profile-password-grid">
                <label className="profile-field profile-field-wide">
                  <span>Текущий пароль</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value);
                      setPasswordMessage("");
                    }}
                    placeholder="Введите текущий пароль"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label className="profile-field">
                  <span>Новый пароль</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setPasswordMessage("");
                    }}
                    placeholder="Минимум 8 символов"
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label className="profile-field">
                  <span>Повторите новый пароль</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setPasswordMessage("");
                    }}
                    placeholder="Введите пароль ещё раз"
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>
              <div className="profile-actions">
                <button className="button button-primary" disabled={savingPassword}>
                  {savingPassword ? "Сохраняем…" : "Изменить пароль"}
                </button>
                {passwordMessage && <span className="save-success">{passwordMessage}</span>}
              </div>
            </form>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function formatRegistrationDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function translateProfileError(message: string) {
  switch (message) {
    case "username is already taken":
      return "Этот логин уже занят";
    case "username must be 3-50 characters and contain only letters, numbers, '.', '_' or '-'":
      return "Логин должен содержать 3–50 допустимых символов";
    case "password must contain 8-72 characters":
      return "Пароль должен содержать от 8 до 72 символов";
    case "bio must contain no more than 500 characters":
      return "Описание должно содержать не более 500 символов";
    case "avatar must be a JPEG, PNG or WebP image up to 1 MB":
      return "Не удалось сохранить фотографию. Выберите JPG, PNG или WebP";
    default:
      return message;
  }
}

function resizeAvatar(file: File): Promise<string> {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return Promise.reject(new Error("Выберите изображение JPG, PNG или WebP"));
  }
  if (file.size > 10 * 1024 * 1024) {
    return Promise.reject(new Error("Исходное изображение должно быть меньше 10 МБ"));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectURL = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectURL);
      const canvas = document.createElement("canvas");
      const size = 512;
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = (image.naturalWidth - sourceSize) / 2;
      const sourceY = (image.naturalHeight - sourceSize) / 2;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Браузер не смог обработать изображение"));
        return;
      }
      context.fillStyle = "#fffdf8";
      context.fillRect(0, 0, size, size);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        size,
        size,
      );
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error("Не удалось прочитать изображение"));
    };
    image.src = objectURL;
  });
}
