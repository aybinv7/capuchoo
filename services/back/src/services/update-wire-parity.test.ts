/**
 * Parity between the deployed backend and the decision it was refactored into.
 *
 * The responses below were captured from production on 2026-08-24, before any
 * of this changed, by posting to `/api/update` for a real app on a real channel.
 * A rewrite of the path that decides what every device installs is only safe if
 * the wire output is accounted for, field by field, and "I read it carefully" is
 * not evidence.
 *
 * Every case asserts the same two things: nothing production sent has changed
 * value or disappeared, and no field appeared that is not declared here. Where a
 * field was added or a value changed, it is named - so the diff between what
 * shipped and what ships now is this file, and can be read in one pass.
 *
 * Storage hostnames are redacted to a placeholder; the path structure, which is
 * what the response shape depends on, is intact.
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
  renderUpdateResponse(decideUpdate(input), { config: {}, gate }) as Record<string, unknown>;

/**
 * Asserts that a response is what production sent plus exactly `added`.
 *
 * Deliberately not `toEqual` against the whole recorded object: that would pass
 * a change through silently the moment a new field is introduced, which is how
 * the wire drifted from the plugin's expectations in the first place.
 */
function expectAdditiveChange(
  actual: Record<string, unknown>,
  recorded: Record<string, unknown>,
  added: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(recorded)) {
    expect({ [key]: actual[key] }).toEqual({ [key]: value });
  }

  const appeared = Object.keys(actual).filter((key) => !(key in recorded));
  expect(appeared.sort()).toEqual(Object.keys(added).sort());

  for (const [key, value] of Object.entries(added)) {
    expect({ [key]: actual[key] }).toEqual({ [key]: value });
  }
}

/**
 * `kind` is new on every response that carries no bundle, and `version` is new
 * wherever a version is known.
 *
 * Neither is decoration. `@capgo/capacitor-updater@7.50.2` reads `version`
 * unconditionally for an unclassified response, and normalises an absent `kind`
 * to "failed" for a classified one - so before this, every background check the
 * plugin made against this backend ended as a failed update, including checks
 * that returned a perfectly good bundle.
 */
describe("responses that gained the fields the plugin reads", () => {
  it("an unknown bundle identifier", () => {
    expectAdditiveChange(
      respond(facts({ app: null })),
      { message: "App not found" },
      { kind: "blocked" },
    );
  });

  it("an unknown channel", () => {
    expectAdditiveChange(
      respond(facts({ channel: null })),
      { message: "Channel not found" },
      { kind: "blocked" },
    );
  });

  // com.efficy.app has no suffix, so it is a production build and the dev
  // channel refuses it. Captured for four device states; all four returned this.
  it("a production build against a dev channel", () => {
    expectAdditiveChange(
      respond(facts({ channel: DEV })),
      { message: "Environment mismatch", config: {} },
      { kind: "blocked" },
    );
  });

  it("a device already ahead of the channel", () => {
    expectAdditiveChange(
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
      { message: "No update available", config: {} },
      { kind: "up_to_date", version: "9.9.9" },
    );
  });

  /**
   * The OTA case, and the one the whole system exists for. `sessionKey` is
   * absent because the stored session key is null, exactly as production
   * omitted it. No `kind`: the plugin treats that key's presence as "there is
   * no bundle here" and would stop before downloading.
   */
  it("an OTA bundle newer than the applied one", () => {
    const response = respond(
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: 70,
          versionName: "1.0.54",
        },
      }),
    );

    expectAdditiveChange(
      response,
      {
        version_name: "1.0.55",
        url: BUNDLE.url,
        checksum: BUNDLE.checksum,
        required: true,
        release_notes: "Correctif obligatoire",
        config: {},
      },
      { version: "1.0.55" },
    );

    expect(response.kind).toBeUndefined();
  });

  // A .staging build on a staging channel resolves identically to the
  // suffixless one, which is the beta-testing exception working as intended.
  it("a suffixed build resolving the same as a suffixless one", () => {
    expect(
      respond(
        facts({
          device: {
            appId: "com.efficy.app.staging",
            platform: "android",
            versionCode: 1,
            versionName: "builtin",
          },
        }),
      ),
    ).toEqual(respond(facts({})));
  });
});

describe("responses whose values deliberately changed", () => {
  /**
   * Production shipped the whole `native_updates` row: the internal `id`, the
   * owning `app_id`, `uploaded_by`, `created_at`, `updated_at`, `active`,
   * `channel`, `min_sdk_version` and `checksum` all went to every device.
   *
   * The decision to serve, the version, the flags and the download URL are
   * unchanged - only the internals are gone, and `file_size` now carries the
   * byte count `file_size_bytes` always held.
   */
  it("a native offer no longer carries database internals", () => {
    const response = respond(facts({}));

    expectAdditiveChange(
      response,
      {
        message: "native_update_available",
        version_name: "1.0.56",
        release_notes: "Binaire obligatoire",
        required: true,
        config: {},
      },
      { kind: "blocked", version: "1.0.56", native_update: response.native_update },
    );

    expect(response.native_update).toEqual({
      version_name: "1.0.56",
      version_code: 67,
      download_url: NATIVE.download_url,
      platform: "android",
      required: true,
      release_notes: "Binaire obligatoire",
      file_size: 47_464_813,
    });

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
   * The device still takes no action. It can now say why, and the plugin no
   * longer reports the check as a failure.
   */
  it("a platform mismatch is named instead of answered with silence", () => {
    expectAdditiveChange(
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
      { config: {} },
      { message: "Platform mismatch", kind: "up_to_date" },
    );
  });

  it("a channel with no bundle is named instead of answered with silence", () => {
    expectAdditiveChange(
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
      { config: {} },
      { message: "No bundle assigned", kind: "up_to_date" },
    );
  });
});
