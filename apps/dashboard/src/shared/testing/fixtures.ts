import type { Build, BuildDetail, BuildJob } from "../types/build";
import type { Bundle, Channel, NativeBuild, ReleaseCatalog } from "../types/release";

export const APP = "app-1";

export function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: "ch-prod",
    name: "prod",
    app_id: APP,
    environment: "prod",
    kind: "release",
    base_channel_id: null,
    public: false,
    allow_device_self_set: false,
    allow_dev: false,
    allow_emulator: false,
    ios_enabled: true,
    android_enabled: true,
    paused: false,
    allow_downgrade: false,
    current_bundle_id: null,
    current_native_id: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

export function bundle(overrides: Partial<Bundle> = {}): Bundle {
  return {
    id: "b-1",
    kind: "ota",
    app_id: APP,
    platform: "android",
    version_name: "1.0.0",
    flavour: "prod",
    size_bytes: 1024,
    checksum: "abc",
    signed: true,
    min_native_version: null,
    required: false,
    release_notes: null,
    uploaded_by: "dev@example.com",
    build_id: null,
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

export function native(overrides: Partial<NativeBuild> = {}): NativeBuild {
  return {
    id: "n-1",
    kind: "native",
    app_id: APP,
    platform: "android",
    version_name: "1.0.0",
    version_code: 10,
    flavour: "prod",
    size_bytes: 4096,
    checksum: "def",
    signed: true,
    signing_cert_sha256: null,
    required: false,
    release_notes: null,
    min_sdk: null,
    uploaded_by: null,
    build_id: null,
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

export function catalog(overrides: Partial<ReleaseCatalog> = {}): ReleaseCatalog {
  return { bundles: [], natives: [], channels: [], ...overrides };
}

export function build(overrides: Partial<Build> = {}): Build {
  return {
    id: "build-1",
    app_id: APP,
    channel_id: null,
    channel_name: "prod",
    kind: "ota",
    status: "running",
    version_name: "1.1.0",
    version_code: null,
    flavour: "prod",
    source: "cli",
    external_id: null,
    commit_sha: null,
    ref: null,
    pipeline_url: null,
    job_url: null,
    actor_user_id: null,
    actor_api_key_id: null,
    bundle_id: null,
    native_id: null,
    error: null,
    started_at: "2026-09-01T00:00:00.000Z",
    finished_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    parent_id: null,
    job_key: null,
    run_attempt: null,
    workflow: null,
    title: null,
    trigger: null,
    ...overrides,
  };
}

export function buildDetail(overrides: Partial<BuildDetail> = {}): BuildDetail {
  return {
    ...build(overrides),
    events: overrides.events ?? [],
    jobs: overrides.jobs ?? [],
    plan: overrides.plan ?? null,
    children: overrides.children ?? [],
  };
}

export function buildJob(overrides: Partial<BuildJob> = {}): BuildJob {
  return {
    id: "job-1",
    build_id: "build-1",
    external_id: "9001",
    plan_key: null,
    name: "build",
    stage: null,
    status: "queued",
    attempt: 1,
    url: null,
    runner: null,
    steps: [],
    started_at: null,
    finished_at: null,
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}
