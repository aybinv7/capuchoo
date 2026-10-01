import { request, type Credentials } from "./http";
import type {
  ArtefactsResponse,
  DownloadLink,
  LoginResponse,
  MeResponse,
  PointRequest,
  ServerApp,
  ServerChannel,
  ServerIdentifier,
} from "./types";

/** One function per server route the app uses; the paths are `services/server/src/routes/*`. */
export const api = {
  login: (endpoint: string, email: string, password: string) =>
    request<LoginResponse>({ endpoint, token: null }, "POST", "/api/auth/login", {
      email,
      password,
    }),

  logout: (c: Credentials) => request<unknown>(c, "POST", "/api/auth/logout"),

  me: (c: Credentials) => request<MeResponse>(c, "GET", "/api/auth/me"),

  apps: (c: Credentials) => request<ServerApp[]>(c, "GET", "/api/apps?counts=1"),

  identifiers: (c: Credentials, appId: string) =>
    request<ServerIdentifier[]>(c, "GET", `/api/apps/${appId}/identifiers`),

  channels: (c: Credentials, appId: string) =>
    request<ServerChannel[]>(c, "GET", `/api/apps/${appId}/channels`),

  artefacts: (c: Credentials, appId: string) =>
    request<ArtefactsResponse>(c, "GET", `/api/apps/${appId}/artefacts?limit=200`),

  nativeDownload: (c: Credentials, nativeId: string) =>
    request<DownloadLink>(c, "GET", `/api/natives/${nativeId}/download`),

  point: (c: Credentials, channelId: string, body: PointRequest) =>
    request<ServerChannel>(c, "POST", `/api/channels/${channelId}/point`, body),

  pause: (c: Credentials, channelId: string, reason?: string) =>
    request<ServerChannel>(c, "POST", `/api/channels/${channelId}/pause`, reason ? { reason } : {}),

  resume: (c: Credentials, channelId: string) =>
    request<ServerChannel>(c, "POST", `/api/channels/${channelId}/resume`, {}),
};
