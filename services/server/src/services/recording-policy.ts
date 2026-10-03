import {
  resolveRecordingPolicy,
  type RecordingPolicyRequest,
  type ResolvedRecordingPolicy,
} from "@capuchoo/core";
import type { Deps } from "../http/context";
import { findAppByBundleId } from "../repositories/apps";
import { listChannels } from "../repositories/channels";
import { findDevice } from "../repositories/devices";
import { listAssets } from "../repositories/recording-assets";
import { layersFor, listRules } from "../repositories/recording-rules";
import { resolveDeviceChannel } from "./channel-resolution";

export type DevicePolicyAnswer =
  | { status: "unknown_app" }
  | { status: "unchanged"; version: string }
  | { status: "policy"; policy: ResolvedRecordingPolicy; knownAssets: string[] };

export function cachedRules(deps: Deps, appId: string) {
  return deps.cache.get(`app:${appId}`, "recording-rules", () => listRules(deps.db, appId));
}

function cachedAssetPaths(deps: Deps, appId: string, versionName: string) {
  return deps.cache.get(`app:${appId}`, `recording-assets:${versionName}`, async () =>
    (await listAssets(deps.db, appId, versionName)).map((asset) => asset.path),
  );
}

/** What this device should record, resolved from the app, channel and device rules. */
export async function policyForDevice(
  deps: Deps,
  request: RecordingPolicyRequest,
): Promise<DevicePolicyAnswer> {
  const identity = await deps.cache.get("identity", request.appId, () =>
    findAppByBundleId(deps.db, request.appId),
  );
  if (!identity) return { status: "unknown_app" };
  const appId = identity.app.id;

  const [channels, device, rules] = await Promise.all([
    deps.cache.get(`app:${appId}`, "channels", () => listChannels(deps.db, appId)),
    findDevice(deps.db, appId, request.deviceId),
    cachedRules(deps, appId),
  ]);
  const { channel } = resolveDeviceChannel({
    channels,
    device,
    reported: request.channel ?? undefined,
  });

  const policy = resolveRecordingPolicy(layersFor(rules, channel?.id ?? null, device?.id ?? null), {
    deviceId: request.deviceId,
    now: deps.now().getTime(),
  });
  if (request.known === policy.version) return { status: "unchanged", version: policy.version };

  const wantsAssets = policy.tracks.replay && (policy.mode !== "off" || policy.ceiling !== "off");
  const knownAssets = wantsAssets ? await cachedAssetPaths(deps, appId, request.versionName) : [];
  return { status: "policy", policy, knownAssets };
}
