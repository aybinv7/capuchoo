import type { Environment } from "@capuchoo/core";
import type { Build, BuildEvent } from "../types/build";
import type { Channel } from "../types/release";

type Row = Record<string, unknown>;

const ENVIRONMENTS = new Set<Environment>(["dev", "staging", "prod"]);

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const flag = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;
const time = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
};

/**
 * The stream publishes channel rows as stored (`is_public`), while the REST API serializes them
 * (`public`). Both become the serialized shape; anything without an id and app is dropped.
 */
export function normalizeChannel(value: unknown): Channel | null {
  if (!isRow(value)) return null;
  const id = text(value.id);
  const appId = text(value.app_id);
  const name = text(value.name);
  const environment = value.environment as Environment;
  if (!id || !appId || !name || !ENVIRONMENTS.has(environment)) return null;
  return {
    id,
    app_id: appId,
    name,
    environment,
    kind: value.kind === "client" ? "client" : "release",
    base_channel_id: text(value.base_channel_id),
    public: flag(value.public ?? value.is_public),
    allow_device_self_set: flag(value.allow_device_self_set),
    allow_dev: flag(value.allow_dev),
    allow_emulator: flag(value.allow_emulator),
    ios_enabled: flag(value.ios_enabled, true),
    android_enabled: flag(value.android_enabled, true),
    paused: flag(value.paused),
    allow_downgrade: flag(value.allow_downgrade),
    current_bundle_id: text(value.current_bundle_id),
    current_native_id: text(value.current_native_id),
    created_at: time(value.created_at),
    updated_at: time(value.updated_at),
  };
}

export function normalizeBuild(value: unknown): Build | null {
  if (!isRow(value) || !text(value.id) || !text(value.app_id)) return null;
  return {
    ...(value as unknown as Build),
    created_at: time(value.created_at) ?? new Date(0).toISOString(),
    started_at: time(value.started_at),
    finished_at: time(value.finished_at),
  };
}

export function normalizeBuildEvent(value: unknown): BuildEvent | null {
  if (!isRow(value)) return null;
  const buildId = text(value.build_id);
  const step = text(value.step);
  if (!buildId || !step || (typeof value.id !== "string" && typeof value.id !== "number"))
    return null;
  return {
    id: String(value.id),
    build_id: buildId,
    step,
    status: (text(value.status) ?? "info") as BuildEvent["status"],
    message: text(value.message),
    created_at: time(value.created_at) ?? new Date(0).toISOString(),
  };
}
