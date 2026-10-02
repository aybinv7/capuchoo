import type { AppRole, Environment } from "@capuchoo/core";
import type { OrgRole, ProdRole } from "@/shared/types/session";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  app_id: string | null;
  role: AppRole | null;
  created_at: string;
  last_used_at?: string | null;
  expires_at: string | null;
}

export interface CreatedApiKey extends ApiKey {
  /** The full key. The server returns it once and stores only its hash. */
  key: string;
}

export interface CreateApiKeyInput {
  name: string;
  app_id: string | null;
  role: AppRole | null;
  expires_in_days?: number;
}

export interface PersonRef {
  id: string;
  email: string;
  full_name: string | null;
}

export interface Member {
  user_id: string;
  role: OrgRole;
  created_at?: string;
  users: PersonRef;
}

export interface Invitation {
  id: string;
  email: string;
  role: OrgRole;
  created_at: string;
  expires_at: string;
}

/** `POST /api/organizations/:id/members`: an existing account is added, anyone else is invited. */
export type InviteResult = Member | { invitation: Invitation & { url: string; token: string } };

export interface AppPermission {
  user_id: string;
  role: AppRole;
  created_at?: string;
  users: PersonRef;
}

export interface AppIdentifier {
  id: string;
  bundle_id: string;
  platform: "android" | "ios" | "all";
  flavour: Environment | null;
  created_at: string;
}

export interface AppPatch {
  name?: string;
  prod_role?: ProdRole;
}

export interface Signing {
  public_key: string | null;
  fingerprint: string | null;
  require_signature: boolean;
}

export interface GitlabStatus {
  configured: boolean;
  webhook_url: string;
  last_event_at: string | null;
}

export interface GitlabConnection {
  webhook_url: string;
  /** The webhook secret. Shown once; the server keeps only its hash. */
  token: string;
}

export type ConfigValueType = "string" | "number" | "boolean" | "json";

export interface ConfigEntry {
  id: string;
  app_id: string;
  environment: "all" | Environment;
  channel: string | null;
  key: string;
  value: string;
  value_type: ConfigValueType;
  created_at: string;
  updated_at: string;
}

export interface ConfigInput {
  key: string;
  value: string;
  value_type: ConfigValueType;
  environment: "all" | Environment;
  channel: string | null;
}

/** `GET /api/admin/demo`: whether the server allows seeding, and the demo organization if any. */
export interface DemoStatus {
  enabled: boolean;
  organization: { id: string; name: string; created_at: string; updated_at: string } | null;
}

export interface DemoApp {
  id: string;
  name: string;
  devices: number;
  events: number;
  runs: number;
}

/** `POST /api/admin/demo`: the organization that replaced the previous demo, and what it holds. */
export interface DemoSeed {
  organization_id: string;
  organization: string;
  apps: DemoApp[];
}
