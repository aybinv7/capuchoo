import { describeConfigProblems, getUpdaterConfig } from "./config.js";
import { getDeviceId, getPlatform, getVersionCode } from "./device.js";
import { requestJson } from "./http.js";
import { readValue, removeValue, writeValue } from "./kv-store.js";

const STORAGE_KEY = "capuchoo.channel";

/** The server would not move this device to the requested channel. */
export class ChannelChangeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ChannelChangeError";
  }
}

interface ChannelSelfResponse {
  channel?: string;
  status?: string;
  allowSet?: boolean;
  error?: string;
  message?: string;
}

let cached: string | null | undefined;

/** The channel this device chose at run time, or null when it follows the build's default. */
export async function getChannelOverride(): Promise<string | null> {
  if (cached !== undefined) return cached;
  const stored = (await readValue(STORAGE_KEY))?.trim();
  cached = stored || null;
  return cached;
}

/** The channel every update check asks: the runtime choice, else the build's default. */
export async function getChannel(): Promise<string> {
  return (await getChannelOverride()) ?? getUpdaterConfig().channel;
}

async function identity() {
  const config = getUpdaterConfig();
  if (!config.apiUrl || !config.appId) {
    throw new ChannelChangeError(describeConfigProblems(config).join("; "));
  }

  const [deviceId, versionCode] = await Promise.all([getDeviceId(), getVersionCode()]);
  return {
    config,
    body: {
      app_id: config.appId,
      device_id: deviceId,
      platform: getPlatform(),
      version_code: String(versionCode),
      defaultChannel: config.channel,
    },
  };
}

/**
 * Moves this device to `name`: the server is told first, and the choice is
 * remembered only once it accepts, so the device never asks a channel the
 * server refused.
 *
 * @throws {ChannelChangeError} when the server refuses or cannot be reached.
 */
export async function setChannel(name: string): Promise<void> {
  const channel = name.trim();
  if (!channel) throw new ChannelChangeError("A channel name is required");

  const { config, body } = await identity();

  let response: ChannelSelfResponse;
  try {
    response = await requestJson<ChannelSelfResponse>(`${config.apiUrl}/api/channel_self`, {
      body: { ...body, channel },
      timeoutMs: config.timeoutMs,
    });
  } catch (error) {
    const reason = (error as { serverMessage?: string }).serverMessage;
    throw new ChannelChangeError(reason ?? `Could not switch to channel "${channel}"`, {
      cause: error,
    });
  }

  if (response.error || response.allowSet === false) {
    throw new ChannelChangeError(
      response.error ?? response.message ?? `Channel "${channel}" cannot be chosen from the app`,
    );
  }

  await writeValue(STORAGE_KEY, channel);
  cached = channel;
}

/**
 * Returns this device to the build's default channel. The local choice is
 * dropped even when the server cannot be told, so the next check asks the
 * default and the server reconciles from there.
 */
export async function clearChannel(): Promise<void> {
  await removeValue(STORAGE_KEY);
  cached = null;

  const { config, body } = await identity();
  const query = new URLSearchParams({
    app_id: body.app_id,
    device_id: body.device_id,
    platform: body.platform,
  });

  try {
    await requestJson(`${config.apiUrl}/api/channel_self?${query.toString()}`, {
      method: "DELETE",
      timeoutMs: config.timeoutMs,
    });
  } catch (error) {
    console.warn("[capuchoo] the server was not told the channel override was cleared", error);
  }
}

/** @internal test hook. */
export function __resetChannelCache(): void {
  cached = undefined;
}
