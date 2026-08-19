export interface User {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  logo_url?: string;
}

export type OrganizationRole = "owner" | "admin" | "member";
export type AppRole = "admin" | "developer" | "tester" | "viewer";

export interface DynamicAppConfig {
  [key: string]: any;
}

export interface App {
  id: string;
  name: string;
  app_id: string; // bundle id
  organization_id: string;
  user_id: string;
  // user_role is injected by the backend helper 'get_user_apps'
  user_role?: AppRole | "org_admin";
  platform: "ios" | "android" | "web" | "all";
  created_at: string;
  updated_at: string;
  icon_url?: string;
  total_devices?: number;
  total_bundles?: number;
  config?: DynamicAppConfig;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
  user?: User;
}

export interface Bundle {
  id: string;
  platform: "android" | "ios" | "web";
  version_name: string;
  download_url: string;
  checksum?: string;
  session_key?: string;
  channel: "prod" | "staging" | "dev";
  required: boolean;
  active: boolean;
  created_at: string;
  created_by?: string;
  min_native_version?: number;
  release_notes?: string;
  is_active_for?: string[];
}

export interface NativeUpdate {
  id: string;
  platform: "android" | "ios";
  version_name: string;
  version_code: number;
  download_url: string;
  checksum?: string;
  channel: "prod" | "staging" | "dev";
  required: boolean;
  active: boolean;
  created_at: string;
  created_by?: string;
  file_size_bytes?: number;
  release_notes?: string;
  is_active_for?: string[];
}

export interface UpdateOrBundle {
  id: string;
  type: "bundle" | "native";
  platform: "android" | "ios" | "web";
  version_name: string;
  version_code?: number;
  download_url: string;
  checksum?: string;
  session_key?: string;
  channel: "prod" | "staging" | "dev";
  required: boolean;
  active: boolean;
  created_at: string;
  created_by?: string;
  file_size_bytes?: number;
  release_notes?: string;
  min_native_version?: number;
  app_id: string;
  app_bundle_id?: string;
  is_active_for?: string[];
}
