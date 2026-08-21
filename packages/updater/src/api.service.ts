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
  getBundleVersion,
  getDeviceId,
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
  versionOs?: string | undefined;
  isEmulator?: boolean | undefined;
  customId?: string | undefined;
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
  if (facts.versionOs) request.versionOs = facts.versionOs;
  if (typeof facts.isEmulator === "boolean") request.isEmulator = facts.isEmulator;
  if (facts.customId) request.customId = facts.customId;

  return request;
}

export async function checkForUpdate(): Promise<ResolvedUpdate | null> {
  if (!isNative()) return null;

  const config = getUpdaterConfig();
  const problems = describeConfigProblems(config);
  if (problems.length > 0) throw new UpdaterConfigError(problems);

  const [versionCode, versionName, deviceId, pluginVersion, osFacts] = await Promise.all([
    getVersionCode(),
    getBundleVersion(),
    getDeviceId(),
    getPluginVersion(),
    getOsFacts(),
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
    ...osFacts,
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
 * Records a native update lifecycle event.
 *
 * Best effort: analytics must never break an update. OTA events are reported
 * by the plugin itself through its `statsUrl`, so only native ones are sent
 * from here.
 */
export async function logUpdateEvent(
  event: UpdateEvent,
  update: ResolvedUpdate,
  details?: { error?: string },
): Promise<void> {
  if (update.kind !== "native") return;

  const config = getUpdaterConfig();
  if (!config.apiUrl) return;

  const payload: UpdateEventPayload = {
    event,
    platform: getPlatform(),
    device_id: await getDeviceId(),
    current_version_code: await getVersionCode(),
    new_version: update.version,
    new_version_code: update.versionCode,
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
