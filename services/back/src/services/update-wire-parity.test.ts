/**
 * Parity between the old `checkForUpdate` and the decision it was refactored into.
 *
 * The responses below were captured from the deployed backend on 2026-08-24,
 * before any of this changed, by posting to `/api/update` for a real app on a
 * real channel. They are the specification the refactor had to preserve: a
 * rewrite of the path that decides what every device installs is only safe if
 * the wire output is the same, and "I read the code carefully" is not evidence.
 *
 * Storage hostnames are redacted to a placeholder - the path structure, which
 * is what the response shape depends on, is intact.
 *
 * Three responses deliberately changed, and each is asserted as a difference
 * rather than quietly accepted. See `CHANGED` below.
 */

import {
  decideUpdate,
  renderUpdateResponse,
  type NativeRelease,
  type OtaRelease,
  type UpdateFacts,
} from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";

const HOST = "https://storage.example/storage/v1/object/public/updates";
const APP = { id: "02f675dc-98f9-4dd1-bfa4-76f06351506c" };

/** The native binary assigned to efficy's staging channel when this was captured. */
const NATIVE: NativeRelease = {
  version_name: "1.0.56",
  version_code: 67,
  download_url: `${HOST}/native/${APP.id}/android/staging/v67-1.0.56.apk`,
  platform: "android",
  required: true,
  release_notes: "Binaire obligatoire",
  file_size_bytes: 47_464_813,
};

/** The OTA bundle assigned to the same channel. */
const BUNDLE: OtaRelease = {
  version_name: "1.0.55",
  url: `${HOST}/bundles/${APP.id}/android/staging/bundle-android-1.0.55-1787608199343.zip`,
  platform: "android",
  checksum: "52a6d49b4483f0394b864729562b9d9e3608006e253869c6a81da8c30f2d5d27",
  session_key: null,
  min_update_version: null,
  required: true,
  release_notes: "Correctif obligatoire",
};

const STAGING = { name: "staging", environment: "staging" } as const;
const DEV = { name: "dev", environment: "dev" } as const;

function facts(overrides: Partial<UpdateFacts>): UpdateFacts {
  return {
    device: {
      appId: "com.efficy.app",
      platform: "android",
      versionCode: 1,
      versionName: "builtin",
    },
    app: APP,
    channel: STAGING,
    native: NATIVE,
    ota: BUNDLE,
    ...overrides,
  };
}

const respond = (input: UpdateFacts, gate: NativeRelease | null = null) =>
  renderUpdateResponse(decideUpdate(input), { config: {}, gate });

describe("responses that must be byte-identical to production", () => {
  it("an unknown bundle identifier", () => {
    expect(respond(facts({ app: null }))).toEqual({ message: "App not found" });
  });

  it("an unknown channel", () => {
    expect(respond(facts({ channel: null }))).toEqual({ message: "Channel not found" });
  });

  // com.efficy.app has no suffix, so it is a production build, and the dev
  // channel refuses it. Captured for four different device states; all four
  // returned this.
  it("a production build against a dev channel", () => {
    expect(respond(facts({ channel: DEV }))).toEqual({
      message: "Environment mismatch",
      config: {},
    });
  });

  it("a device already ahead of the channel", () => {
    expect(
      respond(
        facts({
          device: {
            appId: "com.efficy.app",
            platform: "android",
            versionCode: 9999,
            versionName: "9.9.9",
          },
        }),
      ),
    ).toEqual({ message: "No update available", config: {} });
  });

  /**
   * The OTA case, and the one the whole system exists for. `sessionKey` is
   * absent because the stored session key is null, exactly as production
   * omitted it.
   */
  it("an OTA bundle newer than the applied one", () => {
    expect(
      respond(
        facts({
          device: {
            appId: "com.efficy.app",
            platform: "android",
            versionCode: 70,
            versionName: "1.0.54",
          },
        }),
      ),
    ).toEqual({
      version_name: "1.0.55",
      url: BUNDLE.url,
      checksum: BUNDLE.checksum,
      required: true,
      release_notes: "Correctif obligatoire",
      config: {},
    });
  });

  // A .staging build on a staging channel resolves the same as the suffixless
  // one, which is the beta-testing exception working as intended.
  it("a suffixed build resolving the same as a suffixless one", () => {
    const suffixed = respond(
      facts({
        device: {
          appId: "com.efficy.app.staging",
          platform: "android",
          versionCode: 1,
          versionName: "builtin",
        },
      }),
    );

    expect(suffixed).toEqual(respond(facts({})));
  });
});

describe("responses that deliberately changed", () => {
  /**
   * Production shipped the whole `native_updates` row: the internal `id`, the
   * owning `app_id`, `uploaded_by`, `created_at`, `updated_at`, `active`,
   * `channel`, `min_sdk_version` and `checksum` all went to every device.
   *
   * The decision to serve, the version, the flags and the download URL are
   * unchanged - only the internals are gone, and `file_size` now carries the
   * byte count that `file_size_bytes` always held.
   */
  it("a native offer no longer carries database internals", () => {
    const response = respond(facts({}));

    expect(response).toEqual({
      message: "native_update_available",
      version_name: "1.0.56",
      required: true,
      release_notes: "Binaire obligatoire",
      native_update: {
        version_name: "1.0.56",
        version_code: 67,
        download_url: NATIVE.download_url,
        platform: "android",
        required: true,
        release_notes: "Binaire obligatoire",
        file_size: 47_464_813,
      },
      config: {},
    });

    // What production leaked, and what must never come back.
    for (const leaked of ["id", "app_id", "uploaded_by", "created_at", "updated_at", "active"]) {
      expect(response.native_update).not.toHaveProperty(leaked);
    }

    // Still the rule that cost 45 MB and a day: an APK is never in `url`.
    expect(response.url).toBeUndefined();
  });

  /**
   * Production answered `{"config":{}}` here - the same bytes it sent a device
   * that was up to date, and the same it sent for a channel with no bundle. An
   * iOS device asking an Android-only channel got silence.
   *
   * The device still takes no action. It can now say why.
   */
  it("a platform mismatch is named instead of answered with silence", () => {
    expect(
      respond(
        facts({
          device: {
            appId: "com.efficy.app",
            platform: "ios",
            versionCode: 1,
            versionName: "builtin",
          },
        }),
      ),
    ).toEqual({ message: "Platform mismatch", config: {} });
  });

  it("a channel with no bundle is named instead of answered with silence", () => {
    expect(
      respond(
        facts({
          device: {
            appId: "com.efficy.app.dev",
            platform: "android",
            versionCode: 1,
            versionName: "builtin",
          },
          channel: DEV,
          native: null,
          ota: null,
        }),
      ),
    ).toEqual({ message: "No bundle assigned", config: {} });
  });
});
