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
