/**
 * What a device should install, decided from what the server found.
 *
 * This is the rule that governs every install of every app, and until this file
 * existed it lived as a two-hundred-line branch inside `updateService`,
 * interleaved with five Supabase round trips. It had no tests - not because it
 * was unimportant but because it could not be called without a database. So the
 * only harness available was a physical phone, and every defect in it was found
 * that way: a native binary served in the OTA `url` field, `required` dropped
 * in transit, release notes stored and never sent, a native release the channel
 * never pointed at.
 *
 * Those are one bug, five times: an unexecutable specification. So the decision
 * is separated from the fetching here. `decideUpdate` is pure and total - it
 * takes facts and returns one of a closed set of outcomes - and
 * `renderUpdateResponse` is the only place a wire response is shaped. Both run
 * in microseconds against a table of cases, which is where this class of defect
 * has to be caught, because a phone in someone's hand is not a test suite.
 *
 * The backend had also reimplemented three rules this package already exports:
 * semantic version comparison, the environment isolation check, and the message
 * strings. Copies drift; these do not.
 */

import { isEnvironmentAllowed } from "./project-config.js";
import {
  UpdateMessage,
  type Environment,
  type NativeUpdatePayload,
  type Platform,
  type UpdateCheckResponse,
} from "./update-contract.js";
import { compareVersions } from "./version.js";

/** The build a device is running, as it reports itself. */
export interface DeviceState {
  /** Bundle identifier of the binary, which carries its environment suffix. */
  appId: string;
  platform: Platform;
  /** Native build number. 0 when the device did not report one. */
  versionCode: number;
  /** Applied OTA bundle version, or `"builtin"` when none has landed. */
  versionName: string;
}

export interface ChannelState {
  name: string;
  environment: Environment;
}

/**
 * A native binary row.
 *
 * `file_size_bytes` is the column name; the wire field is `file_size`. They
 * were never mapped, so the contract's `file_size` has never once been
 * populated - `renderUpdateResponse` is where that is now translated.
 */
export interface NativeRelease {
  version_name: string;
  version_code: number;
  download_url: string;
  platform: Platform;
  required?: boolean | null;
  release_notes?: string | null;
  file_size_bytes?: number | null;
}

/** An OTA bundle row. `url` is already resolved to something downloadable. */
export interface OtaRelease {
  version_name: string;
  url: string;
  platform: Platform;
  checksum?: string | null;
  session_key?: string | null;
  /** Native build number this bundle needs; below it, it must not be served. */
  min_update_version?: string | number | null;
  required?: boolean | null;
  release_notes?: string | null;
}

/** Everything the server looked up. Facts only - no decisions. */
export interface UpdateFacts {
  device: DeviceState;
  /** null when no app carries the requested bundle identifier. */
  app: { id: string } | null;
  /** null when the app has no channel by the requested name. */
  channel: ChannelState | null;
  /** The native binary the channel points at, if any. */
  native: NativeRelease | null;
  /** The OTA bundle the channel points at, if any. */
  ota: OtaRelease | null;
}

/**
 * The closed set of outcomes.
 *
 * Every one is named, including the three that used to share a bare
 * `{ config: {} }` response: a channel with no bundle, a bundle built for
 * another platform, and a device already up to date were indistinguishable on
 * the wire, so "the update did nothing" had no diagnosis.
 */
export type UpdateDecision =
  | { kind: "app-not-found" }
  | { kind: "channel-not-found" }
  | { kind: "environment-mismatch"; expected: Environment; channel: ChannelState }
  | { kind: "native"; release: NativeRelease }
  | { kind: "native-required"; minVersionCode: number; installedVersionCode: number }
  | { kind: "ota"; release: OtaRelease }
  | { kind: "no-bundle" }
  | { kind: "platform-mismatch"; bundlePlatform: Platform; devicePlatform: Platform }
  | { kind: "up-to-date"; version: string };

/** `min_update_version` as a number; absent, empty and unparseable all mean ungated. */
function minimumNativeVersion(ota: OtaRelease): number {
  const raw = ota.min_update_version;
  if (raw === null || raw === undefined || raw === "") return 0;
  const parsed = typeof raw === "number" ? raw : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Decides what to serve.
 *
 * The order is load-bearing. Native comes before OTA because the server can
 * have both, and applying a bundle to a binary too old to run it leaves the
 * device broken with no way back. The environment check comes before either, so
 * a staging build can never be handed a production bundle by asking for the
 * wrong channel.
 */
export function decideUpdate(facts: UpdateFacts): UpdateDecision {
  const { device, app, channel, native, ota } = facts;

  if (!app) return { kind: "app-not-found" };
  if (!channel) return { kind: "channel-not-found" };

  if (!isEnvironmentAllowed(device.appId, channel.environment)) {
    return { kind: "environment-mismatch", expected: channel.environment, channel };
  }

  // A native binary assigned to the channel and newer than the installed one
  // supersedes anything OTA. Platform is checked here rather than at the query
  // so an iOS device is never offered an APK.
  if (native && native.platform === device.platform && native.version_code > device.versionCode) {
    return { kind: "native", release: native };
  }

  if (!ota) return { kind: "no-bundle" };

  if (ota.platform !== device.platform) {
    return {
      kind: "platform-mismatch",
      bundlePlatform: ota.platform,
      devicePlatform: device.platform,
    };
  }

  // `"builtin"` is not a semantic version, and compareVersions sorts anything
  // unparseable oldest - which is exactly right: a device that has never taken
  // an update is behind every published bundle.
  if (compareVersions(ota.version_name, device.versionName) <= 0) {
    return { kind: "up-to-date", version: device.versionName };
  }

  const minimum = minimumNativeVersion(ota);
  if (minimum > 0 && device.versionCode < minimum) {
    return {
      kind: "native-required",
      minVersionCode: minimum,
      installedVersionCode: device.versionCode,
    };
  }

  return { kind: "ota", release: ota };
}

/**
 * The wire fields of a native binary, and only those.
 *
 * The previous implementation spread the database row, so every device on earth
 * received the internal `id`, `app_id`, `uploaded_by` and row timestamps.
 */
export function nativePayload(release: NativeRelease): NativeUpdatePayload {
  return {
    version_name: release.version_name,
    version_code: release.version_code,
    download_url: release.download_url,
    platform: release.platform,
    required: release.required ?? false,
    ...(release.release_notes ? { release_notes: release.release_notes } : {}),
    ...(typeof release.file_size_bytes === "number" ? { file_size: release.file_size_bytes } : {}),
  };
}

export interface RenderContext {
  /** Remote configuration for the channel's environment. */
  config: Record<string, unknown>;
  /**
   * The binary satisfying a blocked bundle's `min_update_version`, when one was
   * found. Only consulted for a `native-required` decision, and null when the
   * publisher gated a bundle behind a build they never uploaded.
   */
  gate?: NativeRelease | null;
}

/**
 * Turns a decision into the response the plugin reads.
 *
 * The one rule that must never be broken here: a native binary is offered only
 * through `native_update`, never the top-level `url`. That field is the
 * Capacitor plugin's OTA contract - it downloads whatever is there and unzips
 * it as a web bundle. An APK in it made the plugin fetch 45 MB, fail to unzip
 * it, and report "the update could not be downloaded" while a perfectly
 * installable update sat unread in `native_update`.
 */
export function renderUpdateResponse(
  decision: UpdateDecision,
  context: RenderContext,
): UpdateCheckResponse {
  const { config } = context;

  switch (decision.kind) {
    // Neither carries config: there is no app, or no channel to resolve one for.
    case "app-not-found":
      return { message: UpdateMessage.APP_NOT_FOUND };

    case "channel-not-found":
      return { message: UpdateMessage.CHANNEL_NOT_FOUND };

    case "environment-mismatch":
      return { message: UpdateMessage.ENVIRONMENT_MISMATCH, config };

    case "native": {
      const payload = nativePayload(decision.release);
      return {
        message: UpdateMessage.NATIVE_UPDATE_AVAILABLE,
        // Mirrored at the top level so a client that only reads the flat shape
        // still learns the version and whether it may be postponed.
        version_name: payload.version_name,
        required: payload.required ?? false,
        ...(payload.release_notes ? { release_notes: payload.release_notes } : {}),
        native_update: payload,
        config,
      };
    }

    case "native-required":
      return {
        message: UpdateMessage.NATIVE_UPDATE_REQUIRED,
        error:
          `Native version ${decision.minVersionCode} required. ` +
          `You have ${decision.installedVersionCode}.`,
        native_update: context.gate ? nativePayload(context.gate) : null,
        config,
      };

    case "ota": {
      const { release } = decision;
      return {
        version_name: release.version_name,
        url: release.url,
        ...(release.checksum ? { checksum: release.checksum } : {}),
        ...(release.session_key ? { sessionKey: release.session_key } : {}),
        // Both were stored and then dropped in transit: a release marked
        // required arrived as optional, so a client offered "Later" on an
        // update nobody may postpone.
        required: release.required ?? false,
        ...(release.release_notes ? { release_notes: release.release_notes } : {}),
        config,
      };
    }

    case "no-bundle":
      return { message: UpdateMessage.NO_BUNDLE, config };

    case "platform-mismatch":
      return { message: UpdateMessage.PLATFORM_MISMATCH, config };

    case "up-to-date":
      return { message: UpdateMessage.NO_UPDATE, config };
  }
}

/** One line naming the branch that fired, for the server log. */
export function describeDecision(decision: UpdateDecision): string {
  switch (decision.kind) {
    case "app-not-found":
      return "no app carries this bundle identifier";
    case "channel-not-found":
      return "the app has no channel by that name";
    case "environment-mismatch":
      return `a ${decision.expected} channel refused this build`;
    case "native":
      return `native ${decision.release.version_name} (code ${decision.release.version_code})`;
    case "native-required":
      return (
        `bundle gated behind native ${decision.minVersionCode}, ` +
        `device has ${decision.installedVersionCode}`
      );
    case "ota":
      return `bundle ${decision.release.version_name}`;
    case "no-bundle":
      return "the channel points at no bundle";
    case "platform-mismatch":
      return `the bundle is ${decision.bundlePlatform}, the device is ${decision.devicePlatform}`;
    case "up-to-date":
      return `already on ${decision.version}`;
  }
}
