import { describe, expect, it } from "vite-plus/test";
import {
  UpdateMessage,
  isBlockingResponse,
  parseUpdateEvent,
  resolveUpdate,
} from "./update-contract.js";

describe("resolveUpdate", () => {
  /**
   * The device caught this and no API test could: with autoUpdate
   * "onlyDownload" the Capacitor plugin downloads whatever is in the top-level
   * `url` and unzips it as a web bundle. When the server put a native APK
   * there, the plugin fetched 45 MB, failed to unzip it, and the app showed
   * "the update could not be downloaded" while a perfectly installable update
   * sat in native_update. A native offer must therefore carry no `url`.
   */
  it("reads a native offer that carries no top-level url", () => {
    const resolved = resolveUpdate({
      message: UpdateMessage.NATIVE_UPDATE_AVAILABLE,
      version_name: "1.0.53",
      native_update: {
        version_name: "1.0.53",
        version_code: 64,
        download_url: "https://example.test/v64-1.0.53.apk",
        platform: "android",
        required: false,
      },
    });

    expect(resolved).toMatchObject({
      kind: "native",
      version: "1.0.53",
      versionCode: 64,
      downloadUrl: "https://example.test/v64-1.0.53.apk",
      required: false,
    });
  });

  it("still treats a native offer as required when the server says so", () => {
    const resolved = resolveUpdate({
      message: UpdateMessage.NATIVE_UPDATE_REQUIRED,
      native_update: {
        version_name: "2.0.0",
        version_code: 90,
        download_url: "https://example.test/v90.apk",
        platform: "android",
        required: false,
      },
    });

    expect(resolved).toMatchObject({ kind: "native", required: true });
  });

  it("returns null when there is nothing to install", () => {
    expect(resolveUpdate(null)).toBeNull();
    expect(resolveUpdate({})).toBeNull();
    expect(resolveUpdate({ message: UpdateMessage.NO_UPDATE })).toBeNull();
  });

  it("ignores an OTA bundle with no url", () => {
    expect(resolveUpdate({ version_name: "1.2.0" })).toBeNull();
  });

  it("resolves an OTA bundle", () => {
    const update = resolveUpdate({
      version_name: "1.2.0",
      url: "https://example.test/bundle.zip",
      checksum: "abc",
      sessionKey: "key",
      required: true,
      release_notes: "notes",
    });

    expect(update).toEqual({
      kind: "ota",
      version: "1.2.0",
      downloadUrl: "https://example.test/bundle.zip",
      releaseNotes: "notes",
      required: true,
      checksum: "abc",
      sessionKey: "key",
    });
  });

  it("prefers the native update when the server returns both", () => {
    // The server does exactly this when an OTA bundle declares a
    // min_update_version the device does not satisfy. Installing the bundle
    // first would leave the device on a binary too old to run it.
    const update = resolveUpdate({
      message: UpdateMessage.NATIVE_UPDATE_REQUIRED,
      version_name: "2.0.0",
      url: "https://example.test/bundle.zip",
      native_update: {
        version_name: "1.9.0",
        version_code: 42,
        download_url: "https://example.test/app.apk",
      },
    });

    expect(update?.kind).toBe("native");
    expect(update?.versionCode).toBe(42);
  });

  it("marks a native update required when the message says so", () => {
    const update = resolveUpdate({
      message: UpdateMessage.NATIVE_UPDATE_REQUIRED,
      native_update: {
        version_name: "1.9.0",
        version_code: 42,
        download_url: "https://example.test/app.apk",
        // The record itself is not flagged required, but the device cannot
        // proceed without it.
        required: false,
      },
    });

    expect(update?.required).toBe(true);
  });

  it("falls back to the OTA bundle when native_update has no url", () => {
    // The server returns `native_update: null` when it cannot find the record
    // matching min_update_version.
    const update = resolveUpdate({
      version_name: "1.2.0",
      url: "https://example.test/bundle.zip",
      native_update: null,
    });

    expect(update?.kind).toBe("ota");
  });
});

describe("isBlockingResponse", () => {
  it("flags misconfiguration rather than reporting up to date", () => {
    expect(isBlockingResponse({ message: UpdateMessage.CHANNEL_NOT_FOUND })).toBe(true);
    expect(isBlockingResponse({ message: UpdateMessage.FLAVOUR_MISMATCH })).toBe(true);
    expect(isBlockingResponse({ message: UpdateMessage.NO_UPDATE })).toBe(false);
  });

  /**
   * The rename from ENVIRONMENT_MISMATCH to FLAVOUR_MISMATCH left this function
   * comparing against `UpdateMessage.ENVIRONMENT_MISMATCH`, which is `undefined`.
   * The branch did not become dead - it became `response.message === undefined`,
   * and a response with no message is the ordinary case. Every such check was
   * reported to the user as "the update service rejected this build", with an
   * empty reason, because `UpdateCheckBlockedError` takes its message from a
   * field that was not there.
   *
   * This test is the reason the whole workspace now runs `tsc`: the compiler
   * knew, and nothing was asking it.
   */
  it("does not treat a response without a message as blocked", () => {
    expect(isBlockingResponse({})).toBe(false);
    expect(isBlockingResponse({ kind: "up_to_date" })).toBe(false);
    expect(isBlockingResponse({ version_name: "1.2.0", url: "https://x/b.zip" })).toBe(false);
  });

  it("names only messages that exist", () => {
    // A typo or a rename would otherwise be invisible again.
    const named = [UpdateMessage.CHANNEL_NOT_FOUND, UpdateMessage.FLAVOUR_MISMATCH];

    expect(named.every((message) => typeof message === "string")).toBe(true);
    expect(named.every((message) => isBlockingResponse({ message }))).toBe(true);
  });
});

/**
 * The event a device posts after a native download.
 *
 * Every one of these was rejected with a 400 until 2026-08-25, because the
 * runtime never sent an app id and the server cannot resolve a row without one.
 * The runtime catches the failure and warns, so no native download, install or
 * error was ever recorded and nothing surfaced. It was found by reading the
 * WebView console on a device, mid-install.
 */
describe("parseUpdateEvent", () => {
  // Captured verbatim from the device on 2026-08-25, mid-install.
  const asSent = {
    event: "download_complete",
    platform: "android",
    device_id: "7319d2eb-f383-49aa-a18c-bd2cf6970f41",
    current_version_code: 66,
    new_version: "1.0.56",
    new_version_code: 67,
    channel: "staging",
    environment: "staging",
  };

  it("rejects the payload the runtime actually sent, and says what is missing", () => {
    expect(parseUpdateEvent(asSent)).toEqual({ ok: false, missing: ["app_id"] });
  });

  it("accepts it once the app id is there", () => {
    const parsed = parseUpdateEvent({ ...asSent, app_id: "com.efficy.app" });

    expect(parsed).toMatchObject({
      ok: true,
      event: {
        event: "download_complete",
        platform: "android",
        app_id: "com.efficy.app",
        current_version_code: 66,
        new_version_code: 67,
        channel: "staging",
      },
    });
  });

  // An app built against the older contract must keep recording rather than
  // having its events dropped for a field name.
  it("accepts appId as well as app_id", () => {
    const parsed = parseUpdateEvent({ ...asSent, appId: "com.efficy.app" });
    expect(parsed.ok && parsed.event.app_id).toBe("com.efficy.app");
  });

  /**
   * The second half of the same drift: the runtime sends failure detail as
   * `error`, the server read `error_message`. So even a payload that got past
   * validation lost the only field that said what went wrong.
   */
  it.each(["error", "error_message"])("reads failure detail from %s", (field) => {
    const parsed = parseUpdateEvent({
      ...asSent,
      app_id: "com.efficy.app",
      event: "error",
      [field]: "unzip failed",
    });

    expect(parsed.ok && parsed.event.error).toBe("unzip failed");
  });

  it("names every missing field at once, not just the first", () => {
    expect(parseUpdateEvent({ device_id: "d" })).toEqual({
      ok: false,
      missing: ["event", "platform", "app_id"],
    });
  });

  it("defaults the fields the server can live without", () => {
    const parsed = parseUpdateEvent({
      event: "check",
      platform: "android",
      app_id: "com.efficy.app",
    });

    expect(parsed).toEqual({
      ok: true,
      event: {
        event: "check",
        platform: "android",
        app_id: "com.efficy.app",
        device_id: "",
        current_version_code: 0,
        new_version: undefined,
        new_version_code: undefined,
        channel: "",
        environment: "",
        error: undefined,
      },
    });
  });
});
