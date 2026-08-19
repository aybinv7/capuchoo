import { describe, expect, it } from "vitest";
import {
  UpdateMessage,
  isBlockingResponse,
  resolveUpdate,
} from "./update-contract.js";

describe("resolveUpdate", () => {
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
    expect(isBlockingResponse({ message: UpdateMessage.CHANNEL_NOT_FOUND })).toBe(
      true,
    );
    expect(
      isBlockingResponse({ message: UpdateMessage.ENVIRONMENT_MISMATCH }),
    ).toBe(true);
    expect(isBlockingResponse({ message: UpdateMessage.NO_UPDATE })).toBe(false);
  });
});
