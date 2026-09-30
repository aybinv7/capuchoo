import { http } from "@/shared/api/http";
import type { ApiKey, CreateApiKeyInput, CreatedApiKey } from "../types/settings.types";

export const updateProfile = (fullName: string | null) =>
  http.put<{ id: string; email: string; full_name: string | null }>("/auth/me", {
    full_name: fullName,
  });

export const changePassword = (current: string, next: string) =>
  http.post<{ ok: true }>("/auth/password", { current_password: current, new_password: next });

export const fetchApiKeys = (signal?: AbortSignal) =>
  http
    .get<{ success: boolean; keys: ApiKey[] }>("/api-keys", undefined, signal)
    .then((body) => body.keys);

export const createApiKey = (input: CreateApiKeyInput) =>
  http.post<CreatedApiKey & { success: boolean }>("/api-keys", input);

export const revokeApiKey = (id: string) => http.delete(`/api-keys/${id}`);
