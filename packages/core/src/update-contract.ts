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

/**
 * How the plugin classifies a response that carries no downloadable bundle.
 *
 * Read from `@capgo/capacitor-updater@7.50.2`, which is the authority here:
 * `CapacitorUpdaterPlugin.normalizedUpdateResponseKind` (android, line 4333)
 * maps anything that is not one of these three to `"failed"`, and the check
 * path at line 4515 enters this branch whenever the response has *either* an
 * `error` or a `kind` key.
 *
 * Two consequences the backend must respect, both of which it violated:
 *
 * 1. A response that carries an update must NOT set `kind`, or the plugin
 *    classifies it instead of downloading it.
 * 2. A response that carries no update MUST set `kind`, or it is reported as a
 *    failed update check - which is where the app's "the update could not be
 *    downloaded" came from on a device that was simply up to date.
 */
export type UpdateResponseKind = "up_to_date" | "blocked" | "failed";

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

  /**
   * Classification for a response that carries no bundle. Absent - and it must
   * be absent - when one is offered. See `UpdateResponseKind`.
   */
  kind?: UpdateResponseKind;

  /** OTA bundle fields. */
  version_name?: string;
  /**
   * The same value as `version_name`, under the name the Capacitor plugin
   * reads.
   *
   * `CapacitorUpdaterPlugin` line 4551 calls `jsRes.getString("version")`
   * unconditionally once a response is not classified, and a missing key throws
   * a JSONException that is caught as "error in update check". The backend sent
   * only `version_name`, so every background check the plugin made - on every
   * response, including a perfectly good bundle - ended as a failed update. Our
   * own runtime never noticed because it reads the response itself.
   */
  version?: string;
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
  /**
   * Size in bytes of a native binary, when the server published one.
   *
   * The runtime verifies a cached download against it before reusing the file:
   * a connection dropped mid-download leaves a partial APK at the right path,
   * and installing that fails with "There was a problem parsing the package".
   */
  fileSize?: number;
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
      ...(typeof native.file_size === "number" ? { fileSize: native.file_size } : {}),
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

/**
 * Analytics events posted to `POST {endpoint}/api/native-updates/log`.
 *
 * A list rather than a bare union because `native_update_logs.event` carries a
 * CHECK constraint, and the two had drifted: the column allowed `check`,
 * `download`, `install`, `fail` and `skip` while this declared `check`,
 * `download`, `download_complete`, `install`, `cancel` and `error`. Three of
 * the six were rejected by the database, so a device reporting
 * `download_complete` - which is what one does after every native download -
 * got a 500. `native-update-events.test.ts` reads the migration and fails if
 * this list ever moves ahead of it again.
 */
export const UPDATE_EVENTS = [
  "check",
  "download",
  "download_complete",
  "install",
  "cancel",
  "error",
] as const;

export type UpdateEvent = (typeof UPDATE_EVENTS)[number];

export interface UpdateEventPayload {
  event: UpdateEvent;
  platform: Platform;
  /**
   * Bundle identifier of the running build.
   *
   * `native_update_logs.app_id` is NOT NULL and the server cannot resolve a row
   * without it, so it rejects a payload that omits this with a 400. This field
   * was missing from the contract and from the app runtime, so **every** native
   * download, install and error event was rejected - and because the runtime
   * catches the failure and warns, nothing ever surfaced. It was found by
   * reading the WebView console on a device mid-install.
   */
  app_id: string;
  device_id: string;
  current_version_code: number;
  new_version?: string;
  new_version_code?: number;
  channel: string;
  environment: string;
  /** Failure detail for an `error` event. Older servers read `error_message`. */
  error?: string;
}

/** Field names a payload must carry for the server to record it. */
export const UPDATE_EVENT_REQUIRED = ["event", "platform", "app_id"] as const;

/**
 * Validates an incoming update event, naming everything that is missing.
 *
 * Pure, and shared with the server, so "what the client sends" and "what the
 * server accepts" cannot drift the way they did here: the client sent `error`
 * and the server read `error_message`, so even a payload that got past
 * validation lost its failure detail.
 */
export function parseUpdateEvent(
  body: Record<string, unknown>,
): { ok: true; event: UpdateEventPayload } | { ok: false; missing: string[] } {
  // Accepted under either name, so an app built against an older contract still
  // records rather than having its events silently dropped.
  const appId = (body.app_id ?? body.appId) as string | undefined;

  const missing: string[] = UPDATE_EVENT_REQUIRED.filter((field) =>
    field === "app_id" ? !appId : !body[field],
  );

  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    event: {
      event: body.event as UpdateEvent,
      platform: body.platform as Platform,
      app_id: appId as string,
      device_id: (body.device_id ?? "") as string,
      current_version_code: Number(body.current_version_code ?? 0),
      new_version: body.new_version as string | undefined,
      new_version_code:
        body.new_version_code === undefined ? undefined : Number(body.new_version_code),
      channel: (body.channel ?? "") as string,
      environment: (body.environment ?? "") as string,
      error: (body.error ?? body.error_message) as string | undefined,
    },
  };
}
