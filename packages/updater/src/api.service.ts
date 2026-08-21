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
import { getBundleVersion, getDeviceId, getPlatform, getVersionCode, isNative } from "./device.js";

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
export async function checkForUpdate(): Promise<ResolvedUpdate | null> {
  if (!isNative()) return null;

  const config = getUpdaterConfig();
  const problems = describeConfigProblems(config);
  if (problems.length > 0) throw new UpdaterConfigError(problems);

  const [versionCode, versionName, deviceId] = await Promise.all([
    getVersionCode(),
    getBundleVersion(),
    getDeviceId(),
  ]);

  const request: UpdateCheckRequest = {
    appId: config.appId,
    platform: getPlatform(),
    channel: config.channel,
    defaultChannel: config.channel,
    versionCode: String(versionCode),
    versionBuild: String(versionCode),
    version_name: versionName,
    deviceId,
    isProd: config.environment === "prod",
  };

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
