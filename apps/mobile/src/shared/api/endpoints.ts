import { request, type Credentials } from "./http";
import type { AppRole } from "@/shared/database/schema";
import type {
  AppStats,
  InvitationCreated,
  ServerInvitation,
  ServerMember,
  ServerPermission,
  ArtefactsResponse,
  DevicePage,
  DownloadLink,
  LoginResponse,
  MeResponse,
  PointRequest,
  ServerApp,
  ServerChannel,
  ServerDevice,
  ServerIdentifier,
} from "./types";

/** The most devices the phone lists per app; the server allows 500 a page. */
export const DEVICE_LIMIT = 500;

const PROBE_TIMEOUT_MS = 60_000;

/** One function per server route the app uses; the paths are `services/server/src/routes/*`. */
export const api = {
  /**
   * Unauthenticated `me`: a Capuchoo server answers 401 in JSON, anything else is not one. Given
   * a minute, because a hosted server asleep on a free tier takes most of one to wake.
   */
  probe: (endpoint: string) =>
    request<unknown>({ endpoint, token: null }, "GET", "/api/auth/me", undefined, PROBE_TIMEOUT_MS),

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

  devices: (c: Credentials, appId: string) =>
    request<DevicePage>(c, "GET", `/api/apps/${appId}/devices?limit=${DEVICE_LIMIT}`),

  assignDevice: (c: Credentials, deviceId: string, channelId: string | null) =>
    request<ServerDevice>(c, "PUT", `/api/devices/${deviceId}/channel`, { channel_id: channelId }),

  removeDevice: (c: Credentials, deviceId: string) =>
    request<null>(c, "DELETE", `/api/devices/${deviceId}`),

  stats: (c: Credentials, appId: string, days: number) =>
    request<AppStats>(c, "GET", `/api/apps/${appId}/stats?days=${days}`),

  permissions: (c: Credentials, appId: string) =>
    request<ServerPermission[]>(c, "GET", `/api/apps/${appId}/permissions`),

  /** Sets the role of an existing account; a 404 means the address has no account yet. */
  grant: (c: Credentials, appId: string, email: string, role: AppRole) =>
    request<ServerPermission>(c, "POST", `/api/apps/${appId}/permissions`, { email, role }),

  revoke: (c: Credentials, appId: string, userId: string) =>
    request<null>(c, "DELETE", `/api/apps/${appId}/permissions/${userId}`),

  members: (c: Credentials, orgId: string) =>
    request<ServerMember[]>(c, "GET", `/api/organizations/${orgId}/members`),

  /**
   * Only for an address with no account: for an existing one the server upserts the membership,
   * which would lower an organization admin to member.
   */
  invite: (c: Credentials, orgId: string, email: string) =>
    request<InvitationCreated>(c, "POST", `/api/organizations/${orgId}/members`, {
      email,
      role: "member",
    }),

  invitations: (c: Credentials, orgId: string) =>
    request<ServerInvitation[]>(c, "GET", `/api/organizations/${orgId}/invitations`),

  revokeInvitation: (c: Credentials, orgId: string, invitationId: string) =>
    request<null>(c, "DELETE", `/api/organizations/${orgId}/invitations/${invitationId}`),
};
