/**
 * What a device should install, decided from what the server found.
 *
 * `decideUpdate` is pure over facts; `renderUpdateResponse` is the only place a
 * wire response is shaped. Fetching stays in the backend.
 */

import { describeFlavourMismatch, isFlavourAllowed, type AppIdentity } from "./app-identity.js";
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
  /** Bundle identifier of the binary. Says nothing about its flavour on its own. */
  appId: string;
  platform: Platform;
  /** Native build number. 0 when the device did not report one. */
  versionCode: number;
  /** Applied OTA bundle version, or `"builtin"` when none has landed. */
  versionName: string;
  /**
   * The plugin's `is_prod`: false for a debuggable build.
   *
   * Undefined means the device did not say, which must not be read as false -
   * every device on an older plugin would then be treated as a dev build.
   */
  isProduction?: boolean | undefined;
  /** The plugin's `is_emulator`. Undefined means it did not say. */
  isEmulator?: boolean | undefined;
}

/**
 * A channel, and who it will serve.
 *
 * The flags mirror columns that have existed since the first schema and that
 * nothing read: a channel could be marked `allow_emulator: false` in the
 * database and still serve every emulator that asked. They are optional here
 * and default to permissive, matching both the column defaults and a backend
 * that did not select them.
 */
export interface ChannelState {
  name: string;
  /**
   * The flavour whose builds this channel serves, or null when it is bound to
   * none - in which case no flavour gate applies. This used to default to
   * "staging" when the column was empty, which was a guess made to keep the old
   * suffix rule usable; a channel that claims nothing now gates nothing.
   */
  environment: Environment | null;
  /** `allow_dev`: whether a debuggable build may be served. */
  allowDevBuilds?: boolean | undefined;
  /** `allow_emulator`. */
  allowEmulators?: boolean | undefined;
  iosEnabled?: boolean | undefined;
  androidEnabled?: boolean | undefined;
}

/** A native binary row. The column is `file_size_bytes`; the wire field is `file_size`. */
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
  /**
   * The registered identity for the requested bundle identifier, or null when
   * nothing claims it. Carries the flavour, which is why the decision no longer
   * has to guess one from the identifier's spelling.
   */
  identity: AppIdentity | null;
  /** null when the app has no channel by the requested name. */
  channel: ChannelState | null;
  /** The native binary the channel points at, if any. */
  native: NativeRelease | null;
  /** The OTA bundle the channel points at, if any. */
  ota: OtaRelease | null;
}

/** The closed set of outcomes. */
export type UpdateDecision =
  | { kind: "app-not-found" }
  | { kind: "channel-not-found" }
  | {
      kind: "flavour-mismatch";
      buildFlavour: Environment;
      channelFlavour: Environment;
      channel: ChannelState;
    }
  | { kind: "platform-disabled"; platform: Platform; channel: ChannelState }
  | { kind: "emulator-blocked"; channel: ChannelState }
  | { kind: "dev-build-blocked"; channel: ChannelState }
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
 * Whether the channel serves this platform at all. Absent flags are permissive.
 */
function platformEnabled(channel: ChannelState, platform: Platform): boolean {
  if (platform === "ios") return channel.iosEnabled !== false;
  if (platform === "android") return channel.androidEnabled !== false;

  return true;
}

/**
 * Decides what to serve.
 *
 * Order is load-bearing. Every gate runs before any artefact is chosen, because
 * a device the channel refuses must be told so rather than handed the wrong
 * build; and native runs before OTA, because a bundle applied to a binary too
 * old to run it cannot be undone.
 */
export function decideUpdate(facts: UpdateFacts): UpdateDecision {
  const { device, identity, channel, native, ota } = facts;

  if (!identity) return { kind: "app-not-found" };
  if (!channel) return { kind: "channel-not-found" };

  if (!platformEnabled(channel, device.platform)) {
    return { kind: "platform-disabled", platform: device.platform, channel };
  }

  // Both are non-null whenever isFlavourAllowed says no: it allows a null on
  // either side unconditionally.
  if (!isFlavourAllowed(identity.flavour, channel.environment)) {
    return {
      kind: "flavour-mismatch",
      buildFlavour: identity.flavour as Environment,
      channelFlavour: channel.environment as Environment,
      channel,
    };
  }

  // `=== true` and `=== false` throughout: undefined means the device did not
  // report, and refusing on a value nobody sent would strand every install on
  // an older plugin.
  if (channel.allowEmulators === false && device.isEmulator === true) {
    return { kind: "emulator-blocked", channel };
  }

  if (channel.allowDevBuilds === false && device.isProduction === false) {
    return { kind: "dev-build-blocked", channel };
  }

  // Platform checked here, not at the query, so iOS is never offered an APK.
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

  // `"builtin"` is unparseable, and compareVersions sorts those oldest.
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

/** The wire fields of a native binary, and only those - never the database row. */
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
  /** The binary satisfying a blocked bundle's `min_update_version`, if it exists. */
  gate?: NativeRelease | null;
}

/**
 * Turns a decision into the response the plugin reads.
 *
 * A native binary goes in `native_update`, never the top-level `url` - the
 * plugin downloads whatever is there and unzips it as a web bundle.
 */
export function renderUpdateResponse(
  decision: UpdateDecision,
  context: RenderContext,
): UpdateCheckResponse {
  const { config } = context;

  switch (decision.kind) {
    // Neither carries config: there is no app, or no channel to resolve one for.
    // Both are misconfiguration rather than breakage, so they are "blocked" -
    // the plugin logs those at info and does not raise a failed update.
    case "app-not-found":
      return { message: UpdateMessage.APP_NOT_FOUND, kind: "blocked" };

    case "channel-not-found":
      return { message: UpdateMessage.CHANNEL_NOT_FOUND, kind: "blocked" };

    // All four are "the channel will not serve this device". Blocked rather
    // than failed: nothing is broken, and the plugin logs blocked at info
    // instead of raising a failed update.
    case "flavour-mismatch":
      return { message: UpdateMessage.FLAVOUR_MISMATCH, kind: "blocked", config };

    case "platform-disabled":
      return { message: UpdateMessage.PLATFORM_DISABLED, kind: "blocked", config };

    case "emulator-blocked":
      return { message: UpdateMessage.EMULATOR_BLOCKED, kind: "blocked", config };

    case "dev-build-blocked":
      return { message: UpdateMessage.DEV_BUILD_BLOCKED, kind: "blocked", config };

    case "native": {
      const payload = nativePayload(decision.release);
      return {
        message: UpdateMessage.NATIVE_UPDATE_AVAILABLE,
        // An update exists, but not one the plugin can download and unzip. Left
        // unclassified it would fall through to the bundle path, find no `url`,
        // and be reported as a failed update check.
        kind: "blocked",
        // Mirrored at the top level so a client that only reads the flat shape
        // still learns the version and whether it may be postponed.
        version_name: payload.version_name,
        version: payload.version_name,
        required: payload.required ?? false,
        ...(payload.release_notes ? { release_notes: payload.release_notes } : {}),
        native_update: payload,
        config,
      };
    }

    case "native-required":
      return {
        message: UpdateMessage.NATIVE_UPDATE_REQUIRED,
        // A bundle exists and the device may not have it yet - blocked, not
        // failed. Without this the plugin normalised the missing kind to
        // "failed" and raised downloadFailed on every check.
        kind: "blocked",
        error:
          `Native version ${decision.minVersionCode} required. ` +
          `You have ${decision.installedVersionCode}.`,
        ...(context.gate ? { version: context.gate.version_name } : {}),
        native_update: context.gate ? nativePayload(context.gate) : null,
        config,
      };

    case "ota": {
      const { release } = decision;
      return {
        version_name: release.version_name,
        // The name the plugin reads. Deliberately no `kind` here: the plugin
        // treats the mere presence of that key as "this response carries no
        // bundle" and never downloads.
        version: release.version_name,
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

    // Nothing to serve and nothing wrong. "up_to_date" is the only non-error
    // classification the plugin has; our own `message` keeps the distinction.
    case "no-bundle":
      return { message: UpdateMessage.NO_BUNDLE, kind: "up_to_date", config };

    case "platform-mismatch":
      return { message: UpdateMessage.PLATFORM_MISMATCH, kind: "up_to_date", config };

    case "up-to-date":
      return {
        message: UpdateMessage.NO_UPDATE,
        kind: "up_to_date",
        version: decision.version,
        config,
      };
  }
}

/** One line naming the branch that fired, for the server log. */
export function describeDecision(decision: UpdateDecision): string {
  switch (decision.kind) {
    case "app-not-found":
      return "no app carries this bundle identifier";
    case "channel-not-found":
      return "the app has no channel by that name";
    case "flavour-mismatch":
      return describeFlavourMismatch(
        "this identifier",
        decision.buildFlavour,
        decision.channelFlavour,
        decision.channel.name,
      );
    case "platform-disabled":
      return `channel "${decision.channel.name}" does not serve ${decision.platform}`;
    case "emulator-blocked":
      return `channel "${decision.channel.name}" does not serve emulators`;
    case "dev-build-blocked":
      return `channel "${decision.channel.name}" does not serve debuggable builds`;
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
