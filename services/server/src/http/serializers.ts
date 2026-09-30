import type { AppRole } from "@capuchoo/core";
import type { App, Bundle, Channel, NativeBuild } from "../db/schema";

const iso = (value: Date | string | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null;

export function serializeApp(app: App, role?: AppRole | null) {
  return {
    id: app.id,
    name: app.name,
    app_id: app.app_id,
    platform: app.platform,
    organization_id: app.organization_id,
    icon_url: app.icon_url ?? undefined,
    require_signature: app.require_signature,
    has_public_key: Boolean(app.public_key),
    prod_role: app.prod_role,
    created_at: iso(app.created_at),
    updated_at: iso(app.updated_at),
    ...(role !== undefined ? { role } : {}),
  };
}

export function serializeChannel(channel: Channel) {
  return {
    id: channel.id,
    name: channel.name,
    app_id: channel.app_id,
    environment: channel.environment,
    kind: channel.kind,
    base_channel_id: channel.base_channel_id,
    public: channel.is_public,
    allow_device_self_set: channel.allow_device_self_set,
    allow_dev: channel.allow_dev,
    allow_emulator: channel.allow_emulator,
    ios_enabled: channel.ios_enabled,
    android_enabled: channel.android_enabled,
    paused: channel.paused,
    allow_downgrade: channel.allow_downgrade,
    current_version_id: channel.current_bundle_id,
    current_native_version_id: channel.current_native_id,
    current_bundle_id: channel.current_bundle_id,
    current_native_id: channel.current_native_id,
    created_at: iso(channel.created_at),
    updated_at: iso(channel.updated_at),
  };
}

export function serializeBundle(bundle: Bundle & { uploaded_by_email?: string | null }) {
  return {
    id: bundle.id,
    kind: "ota" as const,
    app_id: bundle.app_id,
    platform: bundle.platform,
    version_name: bundle.version_name,
    flavour: bundle.flavour,
    size_bytes: Number(bundle.size_bytes),
    checksum: bundle.checksum,
    signed: Boolean(bundle.signature),
    min_native_version: bundle.min_native_version,
    required: bundle.required,
    release_notes: bundle.release_notes,
    uploaded_by: bundle.uploaded_by_email ?? null,
    build_id: bundle.build_id,
    created_at: iso(bundle.created_at),
    active: true,
  };
}

export function serializeNative(native: NativeBuild & { uploaded_by_email?: string | null }) {
  return {
    id: native.id,
    kind: "native" as const,
    app_id: native.app_id,
    platform: native.platform,
    version_name: native.version_name,
    version_code: native.version_code,
    flavour: native.flavour,
    size_bytes: Number(native.size_bytes),
    checksum: native.checksum,
    signed: Boolean(native.signature),
    signing_cert_sha256: native.signing_cert_sha256,
    required: native.required,
    release_notes: native.release_notes,
    min_sdk: native.min_sdk,
    uploaded_by: native.uploaded_by_email ?? null,
    build_id: native.build_id,
    created_at: iso(native.created_at),
    active: true,
  };
}
