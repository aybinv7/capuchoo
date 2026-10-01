import type { MeResponse, ServerApp, ServerBundle, ServerChannel, ServerIdentifier, ServerNative } from "@/shared/api/types";
import type {
  AccountTable,
  AppIdentifierTable,
  AppTable,
  BundleTable,
  ChannelTable,
  NativeBuildTable,
  OrganizationTable,
} from "@/shared/database/schema";

const bit = (value: boolean | undefined | null): number => (value ? 1 : 0);

export function toAccount(me: MeResponse, endpoint: string, at: string): AccountTable {
  return {
    id: me.user.id,
    email: me.user.email,
    full_name: me.user.full_name ?? "",
    instance_admin: bit(me.user.role === "instance_admin"),
    endpoint,
    synced_at: at,
  };
}

export function toOrganizations(me: MeResponse): OrganizationTable[] {
  return me.organizations.map((org) => ({ id: org.id, name: org.name, slug: org.slug, role: org.role }));
}

/** An app the server lists without a role is not one this account can act on; it is dropped. */
export function toApps(apps: ServerApp[]): Omit<AppTable, "notify" | "synced_at">[] {
  return apps
    .filter((app) => app.role)
    .map((app) => ({
      id: app.id,
      bundle_id: app.app_id,
      name: app.name,
      organization_id: app.organization_id,
      platform: app.platform,
      role: app.role!,
      prod_role: app.prod_role ?? "admin",
      icon_url: app.icon_url ?? null,
      channel_count: app.counts?.channels ?? 0,
      device_count: app.counts?.devices ?? 0,
      native_count: app.counts?.natives ?? 0,
      bundle_count: app.counts?.bundles ?? 0,
    }));
}

export function toIdentifiers(appId: string, rows: ServerIdentifier[], primary: string): AppIdentifierTable[] {
  const seen = new Map<string, AppIdentifierTable>();
  for (const row of rows) seen.set(row.bundle_id, { app_id: appId, bundle_id: row.bundle_id, flavour: row.flavour });
  if (!seen.has(primary)) seen.set(primary, { app_id: appId, bundle_id: primary, flavour: null });
  return [...seen.values()];
}

export function toChannels(appId: string, rows: ServerChannel[], at: string): ChannelTable[] {
  return rows.map((row) => ({
    id: row.id,
    app_id: appId,
    name: row.name,
    environment: row.environment ?? null,
    kind: row.kind ?? "release",
    base_channel_id: row.base_channel_id ?? null,
    paused: bit(row.paused),
    current_native_id: row.current_native_id ?? null,
    current_bundle_id: row.current_bundle_id ?? null,
    updated_at: row.updated_at ?? row.created_at ?? at,
  }));
}

export function toNatives(appId: string, rows: ServerNative[]): NativeBuildTable[] {
  return rows
    .filter((row) => row.platform === "android")
    .map((row) => ({
      id: row.id,
      app_id: appId,
      version_name: row.version_name,
      version_code: row.version_code,
      flavour: row.flavour,
      size_bytes: row.size_bytes ?? 0,
      checksum: row.checksum,
      signed: bit(row.signed),
      signing_cert_sha256: row.signing_cert_sha256,
      required: bit(row.required),
      release_notes: row.release_notes,
      min_sdk: row.min_sdk,
      channels: JSON.stringify(row.channels ?? []),
      created_at: row.created_at,
    }));
}

export function toBundles(appId: string, rows: ServerBundle[]): BundleTable[] {
  return rows
    .filter((row) => row.platform === "android")
    .map((row) => ({
      id: row.id,
      app_id: appId,
      version_name: row.version_name,
      flavour: row.flavour,
      size_bytes: row.size_bytes ?? 0,
      required: bit(row.required),
      release_notes: row.release_notes,
      min_native_version: row.min_native_version,
      channels: JSON.stringify(row.channels ?? []),
      created_at: row.created_at,
    }));
}
