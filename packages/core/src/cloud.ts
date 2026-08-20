import type { Environment, Platform } from "./update-contract.js";

/** Shapes returned by the authenticated `/api/*` endpoints. */

export interface CloudOrganization {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
}

export interface CloudApp {
  id: string;
  name: string;
  app_id: string;
  platform: string;
  organization_id: string;
  created_at: string;
  icon_url?: string;
}

export interface CloudChannel {
  id: string;
  name: string;
  app_id: string;
  /**
   * Which build flavour this channel serves. The CLI derives the whole build
   * from it, so a channel without an environment cannot be deployed to.
   */
  environment: Environment;
  public: boolean;
  created_at: string;
  current_version_id?: string | null;
  current_native_version_id?: string | null;
}

export interface CloudRelease {
  id: string;
  version_name: string;
  platform: Platform;
  channel?: string;
  active: boolean;
  required: boolean;
  release_notes?: string;
  created_at: string;
}

export interface CloudUser {
  id: string;
  email: string;
  role?: string;
}

/** Response of `GET /api/auth/me`. */
export interface UserProfile {
  user: CloudUser;
  organizations: CloudOrganization[];
  apps: Array<CloudApp & { role: string }>;
}

/** Roles allowed to create an application inside an organization. */
export const APP_CREATOR_ROLES: ReadonlySet<string> = new Set(["owner", "admin"]);

export function canCreateApps(organization: CloudOrganization): boolean {
  return APP_CREATOR_ROLES.has(organization.role);
}
