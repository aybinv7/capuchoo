import {
  decideUpdate,
  describeDecision,
  renderUpdateResponse,
  type NativeRelease,
  type OtaRelease,
  type UpdateCheckResponse,
  type UpdateDecision,
} from "@capuchoo/core";
import type { Deps } from "../http/context";
import type { App, Bundle, Channel, NativeBuild } from "../db/schema";
import { resolveAppConfig } from "../repositories/app-config";
import { findAppByBundleId } from "../repositories/apps";
import { findBundle, findNativeBuild } from "../repositories/artefacts";
import { listChannels } from "../repositories/channels";
import { insertDeviceEvents } from "../repositories/device-events";
import { findDevice, upsertDevice } from "../repositories/devices";
import { artefactUrl } from "./artefact-links";
import { resolveDeviceChannel, type ChannelSource } from "./channel-resolution";
import { requestedChannel, type DeviceRequest } from "./device-request";
import { publishDevice } from "./live-events";

export interface UpdateCheckResult {
  response: UpdateCheckResponse;
  decision: UpdateDecision;
  appId: string | null;
  channel: Channel | null;
  source: ChannelSource;
}

function cachedIdentity(deps: Deps, bundleId: string) {
  return deps.cache.get(`identity`, bundleId, () => findAppByBundleId(deps.db, bundleId));
}

function cachedChannels(deps: Deps, appId: string) {
  return deps.cache.get(`app:${appId}`, "channels", () => listChannels(deps.db, appId));
}

function cachedBundle(deps: Deps, appId: string, id: string | null): Promise<Bundle | undefined> {
  if (!id) return Promise.resolve(undefined);
  return deps.cache.get(`app:${appId}`, `bundle:${id}`, () => findBundle(deps.db, id));
}

function cachedNative(
  deps: Deps,
  appId: string,
  id: string | null,
): Promise<NativeBuild | undefined> {
  if (!id) return Promise.resolve(undefined);
  return deps.cache.get(`app:${appId}`, `native:${id}`, () => findNativeBuild(deps.db, id));
}

async function nativeRelease(
  deps: Deps,
  baseUrl: string,
  native: NativeBuild,
): Promise<NativeRelease> {
  return {
    version_name: native.version_name,
    version_code: native.version_code,
    download_url: await artefactUrl(deps, baseUrl, native.storage_key),
    platform: native.platform,
    required: native.required,
    release_notes: native.release_notes,
    file_size_bytes: Number(native.size_bytes),
    checksum: native.checksum,
    signature: native.signature,
  } as NativeRelease;
}

async function otaRelease(
  deps: Deps,
  baseUrl: string,
  app: App,
  bundle: Bundle,
): Promise<OtaRelease> {
  return {
    version_name: bundle.version_name,
    url: await artefactUrl(deps, baseUrl, bundle.storage_key),
    platform: bundle.platform,
    checksum: bundle.checksum,
    min_update_version: bundle.min_native_version,
    required: bundle.required,
    release_notes: bundle.release_notes,
    signature: bundle.signature,
    app_id: app.app_id,
  } as OtaRelease;
}

/**
 * Answers one device check. Gathers facts, lets `decideUpdate` decide, and records the device and
 * the check alongside the answer; telemetry failures never change the answer.
 */
export async function checkForUpdate(
  deps: Deps,
  request: DeviceRequest,
  baseUrl: string,
): Promise<UpdateCheckResult> {
  const identity = await cachedIdentity(deps, request.appId);
  const app = identity?.app ?? null;

  const [channels, device] = app
    ? await Promise.all([
        cachedChannels(deps, app.id),
        findDevice(deps.db, app.id, request.deviceId),
      ])
    : [[], undefined];

  const { channel, source } = resolveDeviceChannel({
    channels,
    device,
    reported: requestedChannel(request),
  });

  const [bundle, native, config] = await Promise.all([
    app && channel
      ? cachedBundle(deps, app.id, channel.current_bundle_id)
      : Promise.resolve(undefined),
    app && channel
      ? cachedNative(deps, app.id, channel.current_native_id)
      : Promise.resolve(undefined),
    app && channel
      ? deps.cache.get(`app:${app.id}`, `config:${channel.id}`, () =>
          resolveAppConfig(deps.db, app.id, channel.environment, channel.name),
        )
      : Promise.resolve({}),
  ]);

  const [nativeFact, otaFact] = await Promise.all([
    native ? nativeRelease(deps, baseUrl, native) : Promise.resolve(null),
    app && bundle ? otaRelease(deps, baseUrl, app, bundle) : Promise.resolve(null),
  ]);

  const deviceFacts = {
    appId: request.appId,
    platform: request.platform,
    versionCode: request.versionCode,
    versionName: request.versionName,
    builtinVersion: request.versionBuiltin ?? request.versionBuild,
    isProduction: request.isProd,
    isEmulator: request.isEmulator,
  };
  const channelFacts = channel
    ? {
        name: channel.name,
        environment: channel.environment,
        allowDevBuilds: channel.allow_dev,
        allowEmulators: channel.allow_emulator,
        iosEnabled: channel.ios_enabled,
        androidEnabled: channel.android_enabled,
        paused: channel.paused,
        allowDowngrade: channel.allow_downgrade,
      }
    : null;

  const decision = decideUpdate({
    device: deviceFacts,
    identity: identity ? { appId: identity.app.id, flavour: identity.flavour } : null,
    channel: channelFacts,
    native: nativeFact,
    ota: otaFact,
  } as Parameters<typeof decideUpdate>[0]);

  const gate =
    decision.kind === "native-required" &&
    nativeFact &&
    nativeFact.version_code >= decision.minVersionCode
      ? nativeFact
      : null;
  const response = renderUpdateResponse(decision, { config, gate, appId: app?.app_id ?? null });

  if (app) {
    const now = deps.now();
    deps.tasks.run("device telemetry", () =>
      upsertDevice(
        deps.db,
        {
          appId: app.id,
          deviceId: request.deviceId,
          platform: request.platform,
          customId: request.customId,
          isProd: request.isProd,
          isEmulator: request.isEmulator,
          versionName: request.versionName === "builtin" ? undefined : request.versionName,
          versionBuiltin: request.versionBuiltin ?? request.versionBuild,
          versionCode: request.versionCode || undefined,
          versionOs: request.versionOs,
          pluginVersion: request.pluginVersion,
          reportedChannel: requestedChannel(request),
          channelId: channel?.id ?? null,
          deviceName: request.deviceName,
          manufacturer: request.manufacturer,
          model: request.model,
          memUsedBytes: request.memUsedBytes,
          latitude: request.latitude,
          longitude: request.longitude,
          locationAccuracy: request.locationAccuracy,
        },
        now,
      ).then((row) =>
        insertDeviceEvents(deps.db, [
          {
            appId: app.id,
            deviceUuid: row.id,
            channelId: channel?.id ?? null,
            kind: "check",
            action: "check",
            status: "check",
            versionFrom: request.versionName,
            versionTo:
              decision.kind === "ota"
                ? decision.release.version_name
                : decision.kind === "native"
                  ? decision.release.version_name
                  : null,
            details: { outcome: decision.kind, source },
          },
        ]).then(() => {
          publishDevice(deps, app.id, {
            device_uuid: row.id,
            device_id: row.device_id,
            channel_id: row.channel_id,
            event: "check",
            status: decision.kind,
            version: row.version_name,
            version_code: row.version_code,
            model: row.model,
            at: now.toISOString(),
          });
        }),
      ),
    );
  }

  deps.logger.debug("update check", {
    app: request.appId,
    outcome: describeDecision(decision),
    source,
  });
  return { response, decision, appId: app?.id ?? null, channel, source };
}
