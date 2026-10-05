import type { AppRole, Environment, OrganizationRole } from "@/shared/database/schema";

/** The server's JSON, as `services/server/src/http/serializers.ts` writes it. */

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: { id: string; email: string; full_name: string };
}

export interface ServerApp {
  id: string;
  name: string;
  app_id: string;
  platform: string;
  organization_id: string;
  icon_url?: string;
  prod_role: AppRole;
  role?: AppRole;
  counts?: { channels: number; devices: number; bundles: number; natives: number };
}

export interface MeResponse {
  user: { id: string; email: string; full_name: string; role?: "instance_admin" };
  organizations: Array<{ id: string; name: string; slug: string; role: OrganizationRole }>;
  apps: ServerApp[];
}

export interface ServerIdentifier {
  bundle_id: string;
  platform: string;
  flavour: Environment | null;
}

export interface ServerChannel {
  id: string;
  name: string;
  app_id: string;
  environment: Environment | null;
  kind?: "release" | "client";
  base_channel_id?: string | null;
  paused?: boolean;
  current_native_id?: string | null;
  current_bundle_id?: string | null;
  updated_at?: string;
  created_at?: string;
}

interface ServerArtefactBase {
  id: string;
  app_id: string;
  platform: string;
  version_name: string;
  flavour: Environment | null;
  size_bytes: number;
  required: boolean;
  release_notes: string | null;
  created_at: string;
  /** Names of the channels serving it now. */
  channels?: string[];
}

export interface ServerNative extends ServerArtefactBase {
  version_code: number;
  checksum: string | null;
  signed: boolean;
  signing_cert_sha256: string | null;
  min_sdk: number | null;
}

export interface ServerBundle extends ServerArtefactBase {
  min_native_version: number | null;
}

export interface ArtefactsResponse {
  bundles: ServerBundle[];
  natives: ServerNative[];
}

export interface DownloadLink {
  url: string;
  expires_in: number;
}

export interface PointRequest {
  native_id?: string;
  bundle_id?: string;
  rollback?: boolean;
  reason?: string;
}

/** One row of `GET /api/apps/:id/devices`; only what the phone keeps is typed. */
export interface ServerDevice {
  id: string;
  app_id: string;
  device_id: string;
  custom_id: string | null;
  platform: string;
  is_prod: boolean | null;
  is_emulator: boolean | null;
  version_name: string | null;
  version_code: number | null;
  version_os: string | null;
  plugin_version: string | null;
  channel_id: string | null;
  assigned_channel_id: string | null;
  channel_name: string | null;
  device_name: string | null;
  manufacturer: string | null;
  model: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface DevicePage {
  devices: ServerDevice[];
  total: number;
}

export interface DailyActivity {
  day: string;
  checks: number;
  installs: number;
  failures: number;
  devices: number;
}

export interface VersionShare {
  version: string;
  platform: string;
  devices: number;
}

export interface ChannelStats {
  channel_id: string;
  name: string | null;
  devices: number;
  active_24h: number;
  on_current: number;
  installs_24h: number;
  failures_24h: number;
  installs_7d: number;
  failures_7d: number;
}

/** `GET /api/apps/:id/stats?days=`. */
export interface AppStats {
  days: number;
  totals: {
    checks: number;
    installs: number;
    failures: number;
    devices: number;
    active_24h: number;
    success_rate: number | null;
  };
  daily: DailyActivity[];
  versions: VersionShare[];
  channels: ChannelStats[];
}

export interface ServerPerson {
  id: string;
  email: string;
  full_name: string | null;
}

/** One row of `GET /api/apps/:id/permissions`. */
export interface ServerPermission {
  user_id: string;
  role: AppRole;
  created_at?: string;
  users: ServerPerson;
}

/** One row of `GET /api/organizations/:id/members`. */
export interface ServerMember {
  user_id: string;
  role: OrganizationRole;
  created_at?: string;
  users: ServerPerson;
}

/** A pending invitation; its token is only ever returned once, when it is created. */
export interface ServerInvitation {
  id: string;
  email: string;
  role: OrganizationRole;
  created_at: string;
  expires_at: string;
}

/** `POST /api/organizations/:id/members` for an address with no account yet. */
export interface InvitationCreated {
  invitation: ServerInvitation & { url: string; token: string };
}
