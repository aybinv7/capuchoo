/**
 * The wire contract for `POST {endpoint}/api/update`.
 *
 * This file is the single definition shared by the backend that produces the
 * response, the app runtime that consumes it, and the CLI that publishes the
 * artefacts it points at. Before this package existed the three had drifted:
 * the app template asked a second endpoint (`GET /api/native-updates/check`)
 * with an `{ available, update }` envelope the backend never returns on the
 * primary path, and sent a hard-coded `version_name: "builtin"` so the server
 * always compared against 0.0.0.
 */

export type Platform = "android" | "ios" | "web";

/** Deployment environments. A channel is bound to exactly one of these. */
export type Environment = "dev" | "staging" | "prod";

/**
 * Messages the backend puts in `message`. Both sides must agree on the exact
 * strings, so they live here rather than being retyped at each call site.
 */
export const UpdateMessage = {
  /** A newer native binary is assigned to the channel and must be installed. */
  NATIVE_UPDATE_REQUIRED: "native_update_required",
  /** A newer artefact is available. */
  UPDATE_AVAILABLE: "update_available",
  /**
   * A newer native binary is available, but not mandatory.
   *
   * Distinct from UPDATE_AVAILABLE because the top-level `url` is deliberately
   * absent: that field is the Capacitor plugin's OTA contract, and it
   * auto-downloads whatever is there and unzips it. An APK in `url` made the
   * plugin download 45 MB and fail, hiding the real update behind a download
   * error. The binary is in `native_update` instead.
   */
  NATIVE_UPDATE_AVAILABLE: "native_update_available",
  /** The device already runs the newest artefact for its channel. */
  NO_UPDATE: "No update available",
  /** No application carries the requesting bundle identifier. */
  APP_NOT_FOUND: "App not found",
  /** The channel name does not exist for this application. */
  CHANNEL_NOT_FOUND: "Channel not found",
  /**
   * The requesting app id does not belong to the channel's environment - a
   * staging build asking a production channel, for example.
   */
  ENVIRONMENT_MISMATCH: "Environment mismatch",
  /**
   * The channel exists but points at no bundle, and PLATFORM_MISMATCH means it
   * points at one built for another platform.
   *
   * Neither is actionable by the device, and both used to return a bare
   * `{ config: {} }` - the same response as "you are up to date". Three
   * different situations were indistinguishable on the wire, which is why an
   * iOS device asking an Android-only channel produced silence rather than a
   * diagnosis. Clients still take no action; the names exist so the answer to
   * "why did nothing happen" is in the response.
   */
  NO_BUNDLE: "No bundle assigned",
  PLATFORM_MISMATCH: "Platform mismatch",
} as const;

export type UpdateMessageValue = (typeof UpdateMessage)[keyof typeof UpdateMessage];

/** What the device tells the server about itself. */
export interface UpdateCheckRequest {
  /** Bundle identifier of the running build, e.g. `com.ayb.lowmaro.staging`. */
  appId: string;
  platform: Platform;
  /** Channel to consult. Falls back to `defaultChannel` server-side. */
  channel?: string;
  defaultChannel?: string;
  /**
   * Native build number as a string. The server compares this against
   * `native_updates.version_code` and against an OTA bundle's
   * `min_update_version`, so an omitted or wrong value silently disables
   * native-update gating.
   */
  versionCode?: string;
  /** Historical alias for `versionCode`; the server accepts either. */
  versionBuild?: string;
  /**
   * Semantic version of the *currently applied web bundle*, or `"builtin"`
   * when the app still runs the bundle shipped inside the binary. Sending a
   * constant here defeats version comparison entirely.
   */
  version_name?: string;
  /** Stable per-install identifier, used for channel overrides and stats. */
  deviceId?: string;
  isProd?: boolean;
  /**
   * Device facts the server stores but does not decide with. All optional: an
   * app that cannot determine one should omit it rather than send a placeholder,
   * because the server writes only the keys it receives and a placeholder would
   * overwrite a better value recorded earlier.
   */
  versionOs?: string;
  pluginVersion?: string;
  /**
   * Bundle version compiled into the binary. `version_name` is the *applied*
   * OTA bundle and is absent until one lands, so the two together are what say
   * whether a device has ever taken an update.
   */
  versionBuiltin?: string;
  isEmulator?: boolean;
  /** Caller-supplied label for this install, shown in the dashboard. */
  customId?: string;
}

/** A native binary (APK/IPA) the device should install. */
export interface NativeUpdatePayload {
  version_name: string;
  version_code: number;
  download_url: string;
  release_notes?: string;
  required?: boolean;
  platform?: Platform;
  /**
   * Size in bytes, so a client can warn before spending someone's mobile data
   * on 45 MB. The column is `file_size_bytes`; the two were never mapped, so
   * this was declared here and never once populated until `nativePayload`
   * translated it.
   */
  file_size?: number;
}

/**
 * The response. Every field is optional because the server returns a partial
 * object per outcome rather than a discriminated union - `resolveUpdate` below
 * narrows it into something a caller can branch on safely.
 */
export interface UpdateCheckResponse {
  message?: string;
  error?: string;

  /** OTA bundle fields. */
  version_name?: string;
  url?: string;
  checksum?: string;
  sessionKey?: string;
  release_notes?: string;
  required?: boolean;

  /** Present when a native binary supersedes, or blocks, the OTA bundle. */
  native_update?: NativeUpdatePayload | null;

  /** Remote configuration resolved for the channel's environment. */
  config?: Record<string, string>;
}

export type UpdateKind = "native" | "ota";

/** A resolved, actionable update. */
export interface ResolvedUpdate {
  kind: UpdateKind;
  version: string;
  versionCode?: number;
  downloadUrl?: string;
  releaseNotes?: string;
  required: boolean;
  platform?: Platform;
  checksum?: string;
  sessionKey?: string;
  /** Set once the OTA plugin has downloaded the bundle. */
  bundleId?: string;
}

/**
 * Narrows a raw response into an update to act on, or `null` when there is
 * nothing to do.
 *
 * Native wins over OTA. The server can return both - a required native binary
 * alongside the OTA bundle that needs it - and installing the bundle first
 * would leave the device on a binary too old to run it.
 */
export function resolveUpdate(
  response: UpdateCheckResponse | null | undefined,
): ResolvedUpdate | null {
  if (!response) return null;

  const native = response.native_update;
  if (native?.download_url) {
    return {
      kind: "native",
      version: native.version_name,
      versionCode: native.version_code,
      downloadUrl: native.download_url,
      releaseNotes: native.release_notes,
      // A native update is mandatory when the server says the OTA bundle
      // cannot run without it, whatever the record's own flag says.
      required:
        response.message === UpdateMessage.NATIVE_UPDATE_REQUIRED || (native.required ?? false),
      platform: native.platform,
    };
  }

  if (response.url && response.version_name) {
    return {
      kind: "ota",
      version: response.version_name,
      downloadUrl: response.url,
      releaseNotes: response.release_notes,
      required: response.required ?? false,
      checksum: response.checksum,
      sessionKey: response.sessionKey,
    };
  }

  return null;
}

/**
 * True when the response reports a condition the user cannot fix by updating.
 * Callers should surface these instead of showing "you are up to date".
 */
export function isBlockingResponse(response: UpdateCheckResponse): boolean {
  return (
    response.message === UpdateMessage.CHANNEL_NOT_FOUND ||
    response.message === UpdateMessage.ENVIRONMENT_MISMATCH
  );
}

/** Analytics events posted to `POST {endpoint}/api/native-updates/log`. */
export type UpdateEvent =
  | "check"
  | "download"
  | "download_complete"
  | "install"
  | "cancel"
  | "error";

export interface UpdateEventPayload {
  event: UpdateEvent;
  platform: Platform;
  device_id: string;
  current_version_code: number;
  new_version?: string;
  new_version_code?: number;
  channel: string;
  environment: string;
  error?: string;
}
