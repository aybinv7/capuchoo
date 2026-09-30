import type { AppRole, Environment } from "@capuchoo/core";

export type { AppRole, Environment };
export type OrgRole = "owner" | "admin" | "member";
export type ProdRole = "admin" | "developer";

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
  role?: "instance_admin";
}

export interface SessionOrganization {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
}

export interface AppSummary {
  id: string;
  name: string;
  app_id: string;
  platform: string;
  organization_id: string;
  icon_url?: string;
  require_signature: boolean;
  has_public_key: boolean;
  prod_role: ProdRole;
  created_at: string | null;
  updated_at: string | null;
  role?: AppRole | null;
}

export interface AppCounts {
  channels: number;
  devices: number;
  bundles: number;
  natives: number;
}

export interface AppDetail extends AppSummary {
  counts: AppCounts;
  org_role: OrgRole | null;
}

export interface SessionCredential {
  type: "session" | "api_key";
  app_id: string | null;
  role?: AppRole | null;
}

/** `GET /api/auth/me`. */
export interface Me {
  user: SessionUser;
  organizations: SessionOrganization[];
  apps: AppSummary[];
  credential: SessionCredential;
}

/** `POST /api/auth/login`, `/register`, `/invitations/accept`. */
export interface IssuedSession {
  token: string;
  expires_at: string;
  user: { id: string; email: string; full_name: string | null };
}
