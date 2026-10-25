import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "../api/auth";
import { ApiError } from "../api/client";
import type {
  ProfileDetailsInput,
  ProfilePrivacyInput,
  ProfileUpdateInput,
  User,
} from "../types";

const tokenStorageKey = "pomodoro_tracker_token";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
  updateProfileDetails: (input: ProfileDetailsInput) => Promise<void>;
  updateProfilePrivacy: (input: ProfilePrivacyInput) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(tokenStorageKey),
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    authApi
      .getProfile(token)
      .then(({ user: profile }) => {
        if (!cancelled) setUser(profile);
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof ApiError && error.status === 401) {
          localStorage.removeItem(tokenStorageKey);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleLogin(username: string, password: string) {
    const result = await authApi.login(username, password);
    localStorage.setItem(tokenStorageKey, result.token);
    setToken(result.token);
    setUser(result.user);
  }

  async function handleRegister(username: string, password: string) {
    const result = await authApi.register(username, password);
    localStorage.setItem(tokenStorageKey, result.token);
    setToken(result.token);
    setUser(result.user);
  }

  async function updateProfile(input: ProfileUpdateInput) {
    if (!token) return;
    const result = await authApi.updateProfile(token, input);
    localStorage.setItem(tokenStorageKey, result.token);
    setToken(result.token);
    setUser(result.user);
  }

  async function refreshProfile() {
    if (!token) return;
    const { user: profile } = await authApi.getProfile(token);
    setUser(profile);
  }

  async function updateProfileDetails(input: ProfileDetailsInput) {
    if (!token) return;
    const { user: profile } = await authApi.updateProfileDetails(token, input);
    setUser(profile);
  }

  async function updateProfilePrivacy(input: ProfilePrivacyInput) {
    if (!token) return;
    const { user: profile } = await authApi.updateProfilePrivacy(token, input);
    setUser(profile);
  }

  function logout() {
    localStorage.removeItem(tokenStorageKey);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login: handleLogin,
      register: handleRegister,
      updateProfile,
      updateProfileDetails,
      updateProfilePrivacy,
      refreshProfile,
      logout,
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

