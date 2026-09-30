import type { AppRole } from "@capuchoo/core";
import { http } from "@/shared/api/http";
import type { AppDetail, AppSummary } from "@/shared/types/session";
import type {
  AppIdentifier,
  AppPatch,
  AppPermission,
  ConfigEntry,
  ConfigInput,
  GitlabConnection,
  GitlabStatus,
  Signing,
} from "../types/settings.types";

const app = (appId: string) => `/apps/${appId}`;

export const fetchAppDetail = (appId: string, signal?: AbortSignal) =>
  http.get<AppDetail>(app(appId), undefined, signal);
export const updateApp = (appId: string, patch: AppPatch) =>
  http.put<AppSummary>(app(appId), patch);
export const deleteApp = (appId: string) => http.delete(app(appId));

export const fetchIdentifiers = (appId: string, signal?: AbortSignal) =>
  http.get<AppIdentifier[]>(`${app(appId)}/identifiers`, undefined, signal);
export const addIdentifier = (
  appId: string,
  input: Pick<AppIdentifier, "bundle_id" | "platform" | "flavour">,
) => http.post<AppIdentifier>(`${app(appId)}/identifiers`, input);
export const removeIdentifier = (appId: string, bundleId: string) =>
  http.delete(`${app(appId)}/identifiers/${encodeURIComponent(bundleId)}`);

export const fetchPermissions = (appId: string, signal?: AbortSignal) =>
  http.get<AppPermission[]>(`${app(appId)}/permissions`, undefined, signal);
export const grantPermission = (appId: string, email: string, role: AppRole) =>
  http.post<AppPermission>(`${app(appId)}/permissions`, { email, role });
export const revokePermission = (appId: string, userId: string) =>
  http.delete(`${app(appId)}/permissions/${userId}`);

export const fetchSigning = (appId: string, signal?: AbortSignal) =>
  http.get<Signing>(`${app(appId)}/signing`, undefined, signal);
export const updateSigning = (
  appId: string,
  input: { public_key: string | null; require_signature: boolean },
) => http.put<Signing>(`${app(appId)}/signing`, input);

export const fetchGitlab = (appId: string, signal?: AbortSignal) =>
  http.get<GitlabStatus>(`${app(appId)}/integrations/gitlab`, undefined, signal);
export const connectGitlab = (appId: string, project: string | null) =>
  http.put<GitlabConnection>(`${app(appId)}/integrations/gitlab`, { project });
export const disconnectGitlab = (appId: string) => http.delete(`${app(appId)}/integrations/gitlab`);

export const fetchConfig = (appId: string, signal?: AbortSignal) =>
  http.get<ConfigEntry[]>(`${app(appId)}/config`, undefined, signal);
export const saveConfig = (appId: string, input: ConfigInput) =>
  http.put<ConfigEntry>(`${app(appId)}/config`, input);
export const deleteConfig = (appId: string, configId: string) =>
  http.delete(`${app(appId)}/config/${configId}`);
