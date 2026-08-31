import {
  isBlockingResponse,
  resolveUpdate,
  type ResolvedUpdate,
  type UpdateCheckRequest,
  type UpdateCheckResponse,
  type UpdateEvent,
  type UpdateEventPayload,
} from "@capuchoo/core";
import { getUpdaterConfig, describeConfigProblems } from "./config.js";
import {
  getBuiltinVersion,
  getBundleVersion,
  getDeviceId,
  getLocationFacts,
  getOsFacts,
  getPlatform,
  getPluginVersion,
  getVersionCode,
  isNative,
} from "./device.js";

/** Raised when the updater is misconfigured, rather than reporting "up to date". */
export class UpdaterConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(problems.join("; "));
    this.name = "UpdaterConfigError";
    this.problems = problems;
  }
}

/** Raised when the server says the request itself cannot be served. */
export class UpdateCheckBlockedError extends Error {
  readonly response: UpdateCheckResponse;

  constructor(response: UpdateCheckResponse) {
    super(response.message ?? "The update service rejected this request");
    this.name = "UpdateCheckBlockedError";
    this.response = response;
  }
}

async function postJson<T>(url: string, body: unknown, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${url} responded ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks the server what this device should be running.
 *
 * One request, one endpoint. The app template used to call
 * `GET /api/native-updates/check` for native updates *and*
 * `POST /api/update` for OTA, which meant two sources of truth: the native
 * endpoint ignores the channel's assigned native version and the
 * `min_update_version` gate, so a device could be told to install an OTA
 * bundle its binary was too old to run.
 */
export interface DeviceFacts {
  appId: string;
  platform: ReturnType<typeof getPlatform>;
  channel?: string | undefined;
  isProd: boolean;
  versionCode: number;
  versionName: string;
  deviceId: string;
  pluginVersion?: string | undefined;
  versionBuiltin?: string | undefined;
  versionOs?: string | undefined;
  isEmulator?: boolean | undefined;
  customId?: string | undefined;
  deviceName?: string | undefined;
  manufacturer?: string | undefined;
  model?: string | undefined;
  memUsedBytes?: number | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  locationAccuracy?: number | undefined;
}

/**
 * Assemble the check payload.
 *
 * Pure, and separate from the plugin calls that gather the facts, so the shape
 * of what goes on the wire can be tested without a device. Fields the app could
 * not determine are *omitted* rather than sent empty: the server writes only the
 * keys it receives, so a placeholder would overwrite a better value that an
 * earlier, better-informed check had already stored.
 */
export function buildCheckRequest(facts: DeviceFacts): UpdateCheckRequest {
  const request: UpdateCheckRequest = {
    appId: facts.appId,
    platform: facts.platform,
    versionCode: String(facts.versionCode),
    // Historical alias. The server accepts either and prefers versionCode.
    versionBuild: String(facts.versionCode),
    version_name: facts.versionName,
    deviceId: facts.deviceId,
    isProd: facts.isProd,
  };

  if (facts.channel) {
    request.channel = facts.channel;
    request.defaultChannel = facts.channel;
  }
  if (facts.pluginVersion) request.pluginVersion = facts.pluginVersion;
  if (facts.versionBuiltin) request.versionBuiltin = facts.versionBuiltin;
  if (facts.versionOs) request.versionOs = facts.versionOs;
  if (typeof facts.isEmulator === "boolean") request.isEmulator = facts.isEmulator;
  if (facts.customId) request.customId = facts.customId;
  if (facts.deviceName) request.deviceName = facts.deviceName;
  if (facts.manufacturer) request.manufacturer = facts.manufacturer;
  if (facts.model) request.model = facts.model;
  if (typeof facts.memUsedBytes === "number") request.memUsedBytes = facts.memUsedBytes;
  // Sent together or not at all: a latitude with no longitude is not a
  // location, and `getLocationFacts` never produces one without the other.
  if (typeof facts.latitude === "number" && typeof facts.longitude === "number") {
    request.latitude = facts.latitude;
    request.longitude = facts.longitude;
    if (typeof facts.locationAccuracy === "number") {
      request.locationAccuracy = facts.locationAccuracy;
    }
  }

  return request;
}

export async function checkForUpdate(): Promise<ResolvedUpdate | null> {
  if (!isNative()) return null;

  const config = getUpdaterConfig();
  const problems = describeConfigProblems(config);
  if (problems.length > 0) throw new UpdaterConfigError(problems);

  const [
    versionCode,
    versionName,
    deviceId,
    pluginVersion,
    versionBuiltin,
    osFacts,
    locationFacts,
  ] = await Promise.all([
    getVersionCode(),
    getBundleVersion(),
    getDeviceId(),
    getPluginVersion(),
    getBuiltinVersion(),
    getOsFacts(),
    getLocationFacts(),
  ]);

  const request = buildCheckRequest({
    appId: config.appId,
    platform: getPlatform(),
    channel: config.channel,
    isProd: config.environment === "prod",
    versionCode,
    versionName,
    deviceId,
    pluginVersion,
    versionBuiltin,
    ...osFacts,
    ...locationFacts,
  });

  const response = await postJson<UpdateCheckResponse>(
    `${config.apiUrl}/api/update`,
    request,
    config.timeoutMs,
  );

  // "Channel not found" and "Environment mismatch" are deployment mistakes.
  // Treating them as "no update" is how a broken channel goes unnoticed for
  // weeks.
  if (isBlockingResponse(response)) throw new UpdateCheckBlockedError(response);

  return resolveUpdate(response);
}

/**
 * Records an update lifecycle event, OTA or native.
 *
 * This used to return early for anything that was not native, on the grounds
 * that "OTA events are reported by the plugin itself through its statsUrl".
 * They are not. The plugin reports its *own* auto-update flow, and this library
 * exists precisely because the app drives updates instead - `autoUpdate` is
 * "onlyDownload", `directUpdate` is false, and the app calls `set()` when the
 * user agrees. Nothing in that path is the plugin's, so the plugin has nothing
 * to report.
 *
 * The consequence was total: every OTA update ever applied was invisible. A
 * real device took three bundles in an afternoon and the statistics showed
 * `delivered: 0` beside `check: 31`, which reads as "everyone is checking and
 * nobody is updating" - the shape of an outage, produced by a working system.
 *
 * Best effort either way: analytics must never break an update.
 */
export async function logUpdateEvent(
  event: UpdateEvent,
  update: ResolvedUpdate,
  details?: { error?: string },
): Promise<void> {
  const config = getUpdaterConfig();
  if (!config.apiUrl) return;

  const payload: UpdateEventPayload = {
    event,
    platform: getPlatform(),
    // Without this the server has no row to attach the event to and answers
    // 400, which is what it did for every native event ever sent.
    app_id: config.appId,
    device_id: await getDeviceId(),
    current_version_code: await getVersionCode(),
    new_version: update.version,
    // An OTA bundle has no build number of its own - it is a web bundle, and
    // the binary underneath is unchanged. Sending the device's own code would
    // claim the update changed it.
    ...(update.kind === "native" ? { new_version_code: update.versionCode } : {}),
    channel: config.channel,
    environment: String(config.environment),
    ...details,
  };

  try {
    await postJson(`${config.apiUrl}/api/native-updates/log`, payload, config.timeoutMs);
  } catch (error) {
    console.warn("[capuchoo] could not record update event", error);
  }
}
