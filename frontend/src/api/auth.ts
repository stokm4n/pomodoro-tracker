import { apiRequest } from "./client";
import type {
  ProfileDetailsInput,
  ProfilePrivacyInput,
  ProfileUpdateInput,
  User,
} from "../types";

interface AuthResponse {
  user: User;
  token: string;
}

interface ProfileResponse {
  user: User;
}

export function register(username: string, password: string) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function login(username: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getProfile(token: string) {
  return apiRequest<ProfileResponse>("/profile", {}, token);
}

export function updateProfile(token: string, input: ProfileUpdateInput) {
  return apiRequest<AuthResponse>(
    "/profile",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}

export function updateProfileDetails(token: string, input: ProfileDetailsInput) {
  return apiRequest<ProfileResponse>(
    "/profile/details",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}

export function updateProfilePrivacy(token: string, input: ProfilePrivacyInput) {
  return apiRequest<ProfileResponse>(
    "/profile/privacy",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}

