import { normaliseDeviceAttributes, type DeviceAttributes, type Platform } from "@capuchoo/core";

/** A device request after snake_case/camelCase aliases are folded together. */
export interface DeviceRequest {
  appId: string;
  deviceId: string;
  platform: Platform;
  channel?: string | undefined;
  defaultChannel?: string | undefined;
  versionName: string;
  versionBuiltin?: string | undefined;
  /** The plugin's `version_build`: the native app version name, never a build number. */
  versionBuild?: string | undefined;
  versionCode: number;
  versionOs?: string | undefined;
  pluginVersion?: string | undefined;
  isProd?: boolean | undefined;
  isEmulator?: boolean | undefined;
  customId?: string | undefined;
  deviceName?: string | undefined;
  manufacturer?: string | undefined;
  model?: string | undefined;
  memUsedBytes?: number | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  locationAccuracy?: number | undefined;
  /** Set when the app sent attributes; `{}` clears them. */
  attributes?: DeviceAttributes | undefined;
}

type Body = Record<string, unknown>;

function text(body: Body, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim().slice(0, 255);
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function flag(body: Body, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return undefined;
}

function number(body: Body, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = body[key];
    const parsed =
      typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

const PLATFORMS = new Set<Platform>(["android", "ios", "web"]);

/** Folds the plugin's snake_case and the runtime's camelCase into one shape; null when unusable. */
export function parseDeviceRequest(raw: unknown): DeviceRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Body;
  const appId = text(body, "app_id", "appId");
  const deviceId = text(body, "device_id", "deviceId");
  if (!appId || !deviceId) return null;

  const platformText = (text(body, "platform") ?? "android").toLowerCase() as Platform;
  const platform = PLATFORMS.has(platformText) ? platformText : "android";
  const versionCodeText = text(body, "version_code", "versionCode");
  const versionCode =
    versionCodeText && /^\d+$/.test(versionCodeText) ? Number.parseInt(versionCodeText, 10) : 0;
  const location =
    body.location && typeof body.location === "object" ? (body.location as Body) : body;

  return {
    appId,
    deviceId,
    platform,
    channel: text(body, "channel"),
    defaultChannel: text(body, "defaultChannel", "default_channel"),
    versionName: text(body, "version_name", "versionName", "version") ?? "builtin",
    versionBuiltin: text(body, "version_builtin", "versionBuiltin"),
    versionBuild: text(body, "version_build"),
    versionCode,
    versionOs: text(body, "version_os", "versionOs"),
    pluginVersion: text(body, "plugin_version", "pluginVersion"),
    isProd: flag(body, "is_prod", "isProd"),
    isEmulator: flag(body, "is_emulator", "isEmulator"),
    customId: text(body, "custom_id", "customId"),
    deviceName: text(body, "device_name", "deviceName", "name"),
    manufacturer: text(body, "manufacturer"),
    model: text(body, "model"),
    memUsedBytes: number(body, "mem_used_bytes", "memUsed", "memUsedBytes"),
    latitude: number(location, "latitude", "lat"),
    longitude: number(location, "longitude", "lng", "lon"),
    locationAccuracy: number(location, "location_accuracy_m", "accuracy"),
    attributes: normaliseDeviceAttributes(body.attributes)?.attributes,
  };
}

/** The channel the build asks for: explicit first, then the one compiled into the binary. */
export function requestedChannel(request: DeviceRequest): string | undefined {
  return request.channel ?? request.defaultChannel;
}
