/**
 * What the phone keeps of the server: the apps this account may reach, their channels and builds,
 * and what is installed here. Screens read these tables; the sync writes them. Booleans are
 * integers (0/1), timestamps ISO strings, ids the server's UUIDs.
 */

export type AppRole = "viewer" | "tester" | "developer" | "admin";
export type OrganizationRole = "owner" | "admin" | "member";
export type Environment = "dev" | "staging" | "prod";

export interface AccountTable {
  id: string;
  email: string;
  full_name: string;
  instance_admin: number;
  endpoint: string;
  synced_at: string;
}

export interface OrganizationTable {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
}

export interface AppTable {
  id: string;
  bundle_id: string;
  name: string;
  organization_id: string;
  platform: string;
  role: AppRole;
  /** The weakest role that may deliver to prod: `admin` unless the app lowered it. */
  prod_role: AppRole;
  icon_url: string | null;
  channel_count: number;
  device_count: number;
  native_count: number;
  bundle_count: number;
  /** 1 while this phone posts notifications for the app. */
  notify: number;
  synced_at: string | null;
}

export interface AppIdentifierTable {
  app_id: string;
  bundle_id: string;
  /** Null: every flavour installs under this id. */
  flavour: Environment | null;
}

export interface ChannelTable {
  id: string;
  app_id: string;
  name: string;
  environment: Environment | null;
  kind: "release" | "client";
  base_channel_id: string | null;
  paused: number;
  current_native_id: string | null;
  current_bundle_id: string | null;
  updated_at: string;
}

export interface NativeBuildTable {
  id: string;
  app_id: string;
  version_name: string;
  version_code: number;
  flavour: Environment | null;
  size_bytes: number;
  checksum: string | null;
  signed: number;
  signing_cert_sha256: string | null;
  required: number;
  release_notes: string | null;
  min_sdk: number | null;
  /** JSON array of the channel names serving it now. */
  channels: string;
  created_at: string;
}

export interface BundleTable {
  id: string;
  app_id: string;
  version_name: string;
  flavour: Environment | null;
  size_bytes: number;
  required: number;
  release_notes: string | null;
  min_native_version: number | null;
  channels: string;
  created_at: string;
}

/** What the package manager reported for one of an app's identifiers, at `checked_at`. */
export interface InstalledTable {
  bundle_id: string;
  app_id: string;
  installed: number;
  version_name: string | null;
  version_code: number | null;
  updated_at: string | null;
  checked_at: string;
}

export type ActivityKind =
  | "build"
  | "delivered"
  | "rolled_back"
  | "paused"
  | "resumed"
  | "installed"
  | "install_failed";

export interface ActivityTable {
  /** Stable per fact, so the sync and the live stream recording the same event write one row. */
  id: string;
  app_id: string;
  kind: ActivityKind;
  version_name: string | null;
  version_code: number | null;
  channel_name: string | null;
  environment: Environment | null;
  detail: string | null;
  created_at: string;
  read_at: string | null;
}

/**
 * A phone running one of the app's builds, as the server last heard from it. Location and memory
 * are left on the server: nothing on this phone needs them.
 */
export interface DeviceTable {
  id: string;
  app_id: string;
  device_id: string;
  custom_id: string | null;
  platform: string;
  is_prod: number | null;
  is_emulator: number | null;
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

/** The server's statistics for one app over one window, kept whole: it is read whole. */
export interface AppStatsTable {
  app_id: string;
  days: number;
  /** JSON of `GET /api/apps/:id/stats`. */
  payload: string;
  synced_at: string;
}

export interface Database {
  account: AccountTable;
  organization: OrganizationTable;
  app: AppTable;
  app_identifier: AppIdentifierTable;
  channel: ChannelTable;
  native_build: NativeBuildTable;
  bundle: BundleTable;
  installed: InstalledTable;
  activity: ActivityTable;
  device: DeviceTable;
  app_stats: AppStatsTable;
}
