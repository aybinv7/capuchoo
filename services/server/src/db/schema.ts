import type { BuildSource, BuildStatus, JobStatus } from "@capuchoo/core";
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type CreatedAt = ColumnType<Date, Date | string | undefined, never>;
type UpdatedAt = ColumnType<Date, Date | string | undefined, Date | string>;
type Json = ColumnType<unknown, string | undefined, string>;
type BigCount = ColumnType<string | number, number | bigint | undefined, number | bigint>;
type BigId = ColumnType<string | number, string | number | bigint, string | number | bigint>;

export type OrgRole = "owner" | "admin" | "member";
export type AppRoleColumn = "admin" | "developer" | "tester" | "viewer";
export type EnvironmentColumn = "dev" | "staging" | "prod";
export type PlatformColumn = "android" | "ios" | "web";

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string | null;
  full_name: string | null;
  is_instance_admin: Generated<boolean>;
  disabled_at: Timestamp | null;
  last_login_at: Timestamp | null;
  created_at: CreatedAt;
  updated_at: Timestamp;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  ip: string | null;
  user_agent: string | null;
  created_at: CreatedAt;
  last_seen_at: Timestamp;
  expires_at: Timestamp;
}

export interface OrganizationsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  created_at: CreatedAt;
  updated_at: Timestamp;
}

export interface OrganizationMembersTable {
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: CreatedAt;
}

export interface InvitationsTable {
  id: Generated<string>;
  organization_id: string;
  email: string;
  role: OrgRole;
  token_hash: string;
  invited_by: string | null;
  created_at: CreatedAt;
  expires_at: Timestamp;
  accepted_at: Timestamp | null;
}

export interface AppsTable {
  id: Generated<string>;
  organization_id: string;
  app_id: string;
  name: string;
  platform: Generated<string>;
  icon_url: string | null;
  public_key: string | null;
  require_signature: Generated<boolean>;
  prod_role: Generated<"admin" | "developer">;
  created_at: CreatedAt;
  updated_at: Timestamp;
}

export interface AppIdentifiersTable {
  id: Generated<string>;
  app_id: string;
  bundle_id: string;
  platform: Generated<"android" | "ios" | "all">;
  flavour: EnvironmentColumn | null;
  created_at: CreatedAt;
}

export interface AppPermissionsTable {
  app_id: string;
  user_id: string;
  role: AppRoleColumn;
  created_at: CreatedAt;
}

export interface ApiKeysTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  app_id: string | null;
  role: AppRoleColumn | null;
  created_at: CreatedAt;
  last_used_at: Timestamp | null;
  expires_at: Timestamp | null;
  revoked_at: Timestamp | null;
}

export interface ChannelsTable {
  id: Generated<string>;
  app_id: string;
  name: string;
  environment: EnvironmentColumn;
  kind: Generated<"release" | "client">;
  base_channel_id: string | null;
  allow_dev: Generated<boolean>;
  allow_emulator: Generated<boolean>;
  ios_enabled: Generated<boolean>;
  android_enabled: Generated<boolean>;
  allow_device_self_set: Generated<boolean>;
  is_public: Generated<boolean>;
  paused: Generated<boolean>;
  allow_downgrade: Generated<boolean>;
  current_bundle_id: string | null;
  current_native_id: string | null;
  created_at: CreatedAt;
  updated_at: Timestamp;
}

export interface BundlesTable {
  id: Generated<string>;
  app_id: string;
  platform: PlatformColumn;
  version_name: string;
  flavour: EnvironmentColumn;
  storage_key: string;
  size_bytes: BigCount;
  checksum: string;
  signature: string | null;
  min_native_version: number | null;
  required: Generated<boolean>;
  release_notes: string | null;
  uploaded_by: string | null;
  api_key_id: string | null;
  build_id: string | null;
  created_at: CreatedAt;
  deleted_at: Timestamp | null;
}

export interface NativeBuildsTable {
  id: Generated<string>;
  app_id: string;
  platform: "android" | "ios";
  version_name: string;
  version_code: number;
  flavour: EnvironmentColumn;
  storage_key: string;
  size_bytes: BigCount;
  checksum: string;
  signature: string | null;
  signing_cert_sha256: string | null;
  required: Generated<boolean>;
  release_notes: string | null;
  min_sdk: number | null;
  uploaded_by: string | null;
  api_key_id: string | null;
  build_id: string | null;
  created_at: CreatedAt;
  deleted_at: Timestamp | null;
}

export type ChannelAction =
  | "point_bundle"
  | "point_native"
  | "rollback_bundle"
  | "rollback_native"
  | "clear_bundle"
  | "clear_native"
  | "pause"
  | "resume";

export interface ChannelEventsTable {
  id: Generated<string>;
  channel_id: string;
  app_id: string;
  action: ChannelAction;
  from_id: string | null;
  to_id: string | null;
  from_version: string | null;
  to_version: string | null;
  actor_user_id: string | null;
  actor_api_key_id: string | null;
  reason: string | null;
  created_at: CreatedAt;
}

export interface DevicesTable {
  id: Generated<string>;
  app_id: string;
  device_id: string;
  custom_id: string | null;
  platform: PlatformColumn;
  is_prod: boolean | null;
  is_emulator: boolean | null;
  version_name: string | null;
  version_builtin: string | null;
  version_code: number | null;
  version_os: string | null;
  plugin_version: string | null;
  reported_channel: string | null;
  channel_id: string | null;
  assigned_channel_id: string | null;
  self_channel_id: string | null;
  device_name: string | null;
  manufacturer: string | null;
  model: string | null;
  mem_used_bytes: BigCount | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_m: number | null;
  location_reported_at: Timestamp | null;
  attributes: Json | null;
  attributes_updated_at: Timestamp | null;
  last_seen_at: Timestamp;
  created_at: CreatedAt;
  updated_at: Timestamp;
}

export interface DeviceEventsTable {
  id: Generated<string>;
  app_id: string;
  device_uuid: string | null;
  channel_id: string | null;
  kind: "ota" | "native" | "check";
  action: string;
  status: string | null;
  version_from: string | null;
  version_to: string | null;
  version_code_to: number | null;
  error: string | null;
  details: Json | null;
  category: string | null;
  created_at: CreatedAt;
}

export type { BuildStatus };

export interface BuildsTable {
  id: Generated<string>;
  app_id: string;
  channel_id: string | null;
  channel_name: string | null;
  kind: "ota" | "native" | "pipeline";
  status: BuildStatus;
  version_name: string | null;
  version_code: number | null;
  flavour: EnvironmentColumn | null;
  source: BuildSource;
  external_id: string | null;
  commit_sha: string | null;
  ref: string | null;
  pipeline_url: string | null;
  job_url: string | null;
  actor_user_id: string | null;
  actor_api_key_id: string | null;
  bundle_id: string | null;
  native_id: string | null;
  error: string | null;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
  created_at: CreatedAt;
  parent_id: string | null;
  job_key: string | null;
  run_attempt: number | null;
  plan: Json | null;
  workflow: string | null;
  title: string | null;
  trigger: string | null;
  updated_at: UpdatedAt;
}

export interface BuildJobsTable {
  id: Generated<string>;
  build_id: string;
  external_id: string;
  plan_key: string | null;
  name: string;
  stage: string | null;
  status: JobStatus;
  attempt: Generated<number>;
  url: string | null;
  runner: string | null;
  steps: Json;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface BuildJobLogsTable {
  job_id: string;
  content: string;
  truncated: Generated<boolean>;
  fetched_at: CreatedAt;
}

export interface BuildEventsTable {
  id: Generated<string>;
  build_id: string;
  step: string;
  status: "running" | "succeeded" | "failed" | "skipped" | "info";
  message: string | null;
  created_at: CreatedAt;
}

export interface AuditLogTable {
  id: Generated<string>;
  organization_id: string | null;
  app_id: string | null;
  actor_user_id: string | null;
  actor_api_key_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Json | null;
  ip: string | null;
  created_at: CreatedAt;
}

export interface AppConfigTable {
  id: Generated<string>;
  app_id: string;
  environment: "all" | EnvironmentColumn;
  channel: string | null;
  key: string;
  value: string;
  value_type: Generated<"string" | "number" | "boolean" | "json">;
  created_at: CreatedAt;
  updated_at: Timestamp;
}

export type IntegrationKind = "gitlab" | "github";

export interface IntegrationsTable {
  id: Generated<string>;
  app_id: string;
  kind: IntegrationKind;
  secret_hash: string | null;
  config: Json | null;
  external_ref: string | null;
  credential_enc: string | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  last_event_at: Timestamp | null;
}

export interface GithubAppTable {
  id: Generated<number>;
  app_id: BigId;
  slug: string;
  name: string;
  client_id: string;
  client_secret_enc: string;
  private_key_enc: string;
  webhook_secret_enc: string;
  html_url: string;
  owner_login: string | null;
  created_by: string | null;
  created_at: CreatedAt;
}

export interface GithubInstallationsTable {
  id: Generated<string>;
  organization_id: string;
  installation_id: BigId;
  account_login: string;
  account_type: "User" | "Organization";
  repository_selection: "all" | "selected" | null;
  suspended_at: Timestamp | null;
  created_by: string | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface BlobsTable {
  key: string;
  size_bytes: BigCount;
  content_type: string;
  created_at: CreatedAt;
}

export interface BlobChunksTable {
  key: string;
  idx: number;
  data: Buffer;
}

export interface RecordingSessionsTable {
  id: Generated<string>;
  app_id: string;
  session_key: string;
  device_uuid: string | null;
  device_id: string;
  platform: string;
  version_name: string;
  version_code: number | null;
  channel: string | null;
  start: string;
  mode: string;
  note: string | null;
  device: Json | null;
  recorder: string | null;
  started_at: Timestamp;
  ended_at: Timestamp;
  segment_count: Generated<number>;
  event_count: Generated<BigCount>;
  size_bytes: Generated<BigCount>;
  error_count: Generated<number>;
  finished: Generated<boolean>;
  last_segment_at: Timestamp;
  created_at: CreatedAt;
}

export interface RecordingSegmentsTable {
  session_id: string;
  seq: number;
  storage_key: string;
  size_bytes: number;
  raw_bytes: number;
  events: number;
  errors: number;
  full_snapshot: boolean;
  started_at: Timestamp;
  ended_at: Timestamp;
  created_at: CreatedAt;
}

export interface RecordingRulesTable {
  id: Generated<string>;
  app_id: string;
  scope: "app" | "channel" | "device";
  channel_id: string | null;
  device_uuid: string | null;
  policy: Json;
  live_until: Timestamp | null;
  updated_by: string | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface RecorderHealthTable {
  app_id: string;
  device_id: string;
  device_uuid: string | null;
  platform: string;
  version_name: string;
  channel: string | null;
  health: Json;
  seen_at: Timestamp;
}

export interface RecordingIssuesTable {
  id: Generated<string>;
  app_id: string;
  fingerprint: string;
  message: string;
  frame: string | null;
  status: Generated<"open" | "resolved" | "regressed">;
  occurrences: BigCount;
  first_version: string;
  last_version: string;
  first_seen: Timestamp;
  last_seen: Timestamp;
  resolved_at: Timestamp | null;
}

export interface RecordingIssueSessionsTable {
  issue_id: string;
  session_id: string;
  device_id: string;
  version_name: string;
  first_at: Timestamp;
  occurrences: Generated<number>;
}

export interface SourceMapsTable {
  id: Generated<string>;
  app_id: string;
  version_name: string;
  path: string;
  storage_key: string;
  size_bytes: BigCount;
  created_at: CreatedAt;
}

export interface RecordingAssetsTable {
  id: Generated<string>;
  app_id: string;
  version_name: string;
  path: string;
  sha256: string;
  content_type: string;
  storage_key: string;
  size_bytes: number;
  created_at: CreatedAt;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  organizations: OrganizationsTable;
  organization_members: OrganizationMembersTable;
  invitations: InvitationsTable;
  apps: AppsTable;
  app_identifiers: AppIdentifiersTable;
  app_permissions: AppPermissionsTable;
  api_keys: ApiKeysTable;
  channels: ChannelsTable;
  bundles: BundlesTable;
  native_builds: NativeBuildsTable;
  channel_events: ChannelEventsTable;
  devices: DevicesTable;
  device_events: DeviceEventsTable;
  builds: BuildsTable;
  build_events: BuildEventsTable;
  build_jobs: BuildJobsTable;
  build_job_logs: BuildJobLogsTable;
  audit_log: AuditLogTable;
  app_config: AppConfigTable;
  integrations: IntegrationsTable;
  github_app: GithubAppTable;
  github_installations: GithubInstallationsTable;
  blobs: BlobsTable;
  blob_chunks: BlobChunksTable;
  recording_sessions: RecordingSessionsTable;
  recording_segments: RecordingSegmentsTable;
  recording_rules: RecordingRulesTable;
  recording_assets: RecordingAssetsTable;
  recorder_health: RecorderHealthTable;
  source_maps: SourceMapsTable;
  recording_issues: RecordingIssuesTable;
  recording_issue_sessions: RecordingIssueSessionsTable;
}

export type User = Selectable<UsersTable>;
export type App = Selectable<AppsTable>;
export type Channel = Selectable<ChannelsTable>;
export type ChannelUpdate = Updateable<ChannelsTable>;
export type Bundle = Selectable<BundlesTable>;
export type NativeBuild = Selectable<NativeBuildsTable>;
export type NewBundle = Insertable<BundlesTable>;
export type NewNativeBuild = Insertable<NativeBuildsTable>;
export type Device = Selectable<DevicesTable>;
export type Build = Selectable<BuildsTable>;
export type BuildEvent = Selectable<BuildEventsTable>;
export type BuildJob = Selectable<BuildJobsTable>;
export type Integration = Selectable<IntegrationsTable>;
export type GithubAppRow = Selectable<GithubAppTable>;
export type GithubInstallation = Selectable<GithubInstallationsTable>;
export type ApiKey = Selectable<ApiKeysTable>;
export type RecordingSession = Selectable<RecordingSessionsTable>;
export type RecordingSegment = Selectable<RecordingSegmentsTable>;
export type RecordingRule = Selectable<RecordingRulesTable>;
export type RecordingAsset = Selectable<RecordingAssetsTable>;
