/**
 * The golden matrix for the update decision.
 *
 * Every defect this project shipped in the update path was found on a physical
 * phone, because the decision could not be called without a database. Each one
 * is a row here now, and the table is the specification: server output and the
 * client's reading of it are asserted together, so the two halves cannot drift
 * the way they did when the backend restated the rules by hand.
 */

import { describe, expect, it } from "vite-plus/test";
import { UpdateMessage, resolveUpdate } from "./update-contract.js";
import {
  decideUpdate,
  nativePayload,
  renderUpdateResponse,
  type NativeRelease,
  type OtaRelease,
  type UpdateFacts,
} from "./update-decision.js";

/** Registered, and making no flavour claim - the common single-identifier app. */
const SHARED = { appId: "app-uuid", bundleId: "com.efficy.app", flavour: null } as const;

const android: NativeRelease = {
  version_name: "1.0.56",
  version_code: 67,
  download_url: "https://cdn.test/v67-1.0.56.apk",
  platform: "android",
  required: false,
  release_notes: "Binaire obligatoire",
  file_size_bytes: 47_464_813,
};

const bundle: OtaRelease = {
  version_name: "1.0.55",
  url: "https://cdn.test/bundle-1.0.55.zip",
  platform: "android",
  checksum: "52a6d49b",
  session_key: null,
  min_update_version: null,
  required: false,
  release_notes: null,
};

/** An Android device on a prod channel, up to date on nothing. */
function facts(overrides: Partial<UpdateFacts> = {}): UpdateFacts {
  return {
    device: {
      appId: "com.efficy.app",
      platform: "android",
      versionCode: 60,
      versionName: "builtin",
    },
    identity: SHARED,
    channel: { name: "production", environment: "prod" },
    native: null,
    ota: null,
    ...overrides,
  };
}

const render = (input: UpdateFacts) => renderUpdateResponse(decideUpdate(input), { config: {} });

describe("which outcome fires", () => {
  it("reports an unknown bundle identifier", () => {
    expect(decideUpdate(facts({ identity: null }))).toEqual({ kind: "app-not-found" });
  });

  it("reports an unknown channel", () => {
    expect(decideUpdate(facts({ channel: null }))).toEqual({ kind: "channel-not-found" });
  });

  it("refuses an identifier registered as staging on the production channel", () => {
    const decision = decideUpdate(
      facts({
        identity: {
          appId: "app-uuid",
          bundleId: "com.efficy.app.staging",
          flavour: "staging",
        },
        ota: bundle,
      }),
    );

    expect(decision).toMatchObject({ kind: "flavour-mismatch", buildFlavour: "staging" });
  });

  /**
   * The case the old heuristic could not serve at all, and the reason for this
   * rewrite. Lowmaro builds dev, staging and prod from `com.ayb.lowmaro`, so
   * every build parsed as production and its dev channel was unreachable. A
   * shared identifier makes no flavour claim, so there is nothing to refuse.
   */
  it("serves every channel to an identifier shared by all flavours", () => {
    for (const environment of ["prod", "staging", "dev"] as const) {
      const decision = decideUpdate(
        facts({ channel: { name: environment, environment }, ota: bundle }),
      );

      expect(decision).toMatchObject({ kind: "ota" });
    }
  });

  it("serves a dev-registered identifier its own channel", () => {
    const decision = decideUpdate(
      facts({
        identity: { appId: "app-uuid", bundleId: "com.efficy.app.dev", flavour: "dev" },
        channel: { name: "dev", environment: "dev" },
        ota: bundle,
      }),
    );

    expect(decision).toMatchObject({ kind: "ota" });
  });

  it("serves a native binary newer than the installed one", () => {
    expect(decideUpdate(facts({ native: android, ota: bundle }))).toMatchObject({
      kind: "native",
      release: { version_code: 67 },
    });
  });

  it.each([
    ["equal to", 67],
    ["newer than", 68],
  ])("ignores a native binary %s the installed build", (_label, installed) => {
    const decision = decideUpdate(
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: installed,
          versionName: "builtin",
        },
        native: android,
        ota: bundle,
      }),
    );

    expect(decision).toMatchObject({ kind: "ota" });
  });

  // An iOS device must never be handed an APK, whatever the channel points at.
  it("does not offer an Android binary to an iOS device", () => {
    const decision = decideUpdate(
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "ios",
          versionCode: 1,
          versionName: "builtin",
        },
        native: android,
        ota: null,
      }),
    );

    expect(decision).toEqual({ kind: "no-bundle" });
  });

  it("names a channel that points at nothing", () => {
    expect(decideUpdate(facts())).toEqual({ kind: "no-bundle" });
  });

  it("names a bundle built for another platform", () => {
    const decision = decideUpdate(
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "ios",
          versionCode: 1,
          versionName: "builtin",
        },
        ota: bundle,
      }),
    );

    expect(decision).toMatchObject({
      kind: "platform-mismatch",
      bundlePlatform: "android",
      devicePlatform: "ios",
    });
  });

  it.each([
    ["the same version", "1.0.55"],
    ["a newer version", "2.0.0"],
  ])("reports up to date when the device runs %s", (_label, versionName) => {
    const decision = decideUpdate(
      facts({
        device: { appId: "com.efficy.app", platform: "android", versionCode: 60, versionName },
        ota: bundle,
      }),
    );

    expect(decision).toMatchObject({ kind: "up-to-date" });
  });

  // "builtin" is not a semantic version, and must sort behind every release -
  // a device that has never taken an update is behind all of them.
  it("treats builtin as older than any published bundle", () => {
    expect(decideUpdate(facts({ ota: bundle }))).toMatchObject({ kind: "ota" });
  });

  it("orders a prerelease before its final version", () => {
    const decision = decideUpdate(
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: 60,
          versionName: "1.0.55-beta.1",
        },
        ota: bundle,
      }),
    );

    expect(decision).toMatchObject({ kind: "ota" });
  });
});

describe("the min_update_version gate", () => {
  const gated: OtaRelease = { ...bundle, min_update_version: "67" };

  it("blocks a bundle the installed binary cannot run", () => {
    expect(decideUpdate(facts({ ota: gated }))).toEqual({
      kind: "native-required",
      minVersionCode: 67,
      installedVersionCode: 60,
    });
  });

  it("serves the bundle once the binary satisfies it", () => {
    const decision = decideUpdate(
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: 67,
          versionName: "builtin",
        },
        ota: gated,
      }),
    );

    expect(decision).toMatchObject({ kind: "ota" });
  });

  // Every one of these reached the old `parseInt(x || "0") || 0`, and any of
  // them turning into a positive number would block a bundle for every device.
  it.each([null, undefined, "", "0", "not-a-number", 0])("treats %s as ungated", (value) => {
    const decision = decideUpdate(
      facts({ ota: { ...bundle, min_update_version: value as string | number | null } }),
    );

    expect(decision).toMatchObject({ kind: "ota" });
  });
});

/**
 * Rules read out of `@capgo/capacitor-updater@7.50.2`, whose Android source
 * ships in the package. They are asserted over every outcome rather than case
 * by case, because a tenth decision added later must not be able to break them
 * quietly.
 *
 * With `autoUpdate: "onlyDownload"` the plugin runs its own background check
 * against our endpoint, separate from anything our runtime does. Until these
 * rules were followed, every one of those checks ended as a failed update - on
 * a good bundle, on an up-to-date device, on everything.
 */
describe("the contract the Capacitor plugin actually enforces", () => {
  const everyOutcome: Array<[string, UpdateFacts]> = [
    ["app-not-found", facts({ identity: null })],
    ["channel-not-found", facts({ channel: null })],
    [
      "flavour-mismatch",
      facts({
        identity: { appId: "app-uuid", bundleId: "com.efficy.app.staging", flavour: "staging" },
        ota: bundle,
      }),
    ],
    [
      "platform-disabled",
      facts({
        channel: { name: "production", environment: "prod", androidEnabled: false },
        ota: bundle,
      }),
    ],
    [
      "emulator-blocked",
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: 60,
          versionName: "builtin",
          isEmulator: true,
        },
        channel: { name: "production", environment: "prod", allowEmulators: false },
        ota: bundle,
      }),
    ],
    [
      "dev-build-blocked",
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: 60,
          versionName: "builtin",
          isProduction: false,
        },
        channel: { name: "production", environment: "prod", allowDevBuilds: false },
        ota: bundle,
      }),
    ],
    ["native", facts({ native: android, ota: bundle })],
    ["native-required", facts({ ota: { ...bundle, min_update_version: "67" } })],
    ["ota", facts({ ota: bundle })],
    ["no-bundle", facts()],
    [
      "platform-mismatch",
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "ios",
          versionCode: 1,
          versionName: "builtin",
        },
        ota: bundle,
      }),
    ],
    [
      "up-to-date",
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: 60,
          versionName: "9.9.9",
        },
        ota: bundle,
      }),
    ],
  ];

  it("covers every decision", () => {
    const kinds = everyOutcome.map(([, input]) => decideUpdate(input).kind);
    expect(new Set(kinds).size).toBe(everyOutcome.length);
  });

  /**
   * `CapacitorUpdaterPlugin` line 4515 enters its classification branch when the
   * response has *either* `error` or `kind`, and never looks for a bundle after
   * that. A downloadable response carrying `kind` is therefore never downloaded.
   */
  it.each(everyOutcome)("%s classifies itself only when it carries no bundle", (label, input) => {
    const response = render(input);

    // Asserted unconditionally, and reported with the values: a branch that
    // stops being reached would otherwise leave the case silently unasserted.
    expect({
      case: label,
      // `kind` is present exactly when there is no bundle to download.
      classifiedWhenEmpty: (response.kind !== undefined) === (response.url === undefined),
      // `error` never rides along with a bundle.
      errorFreeBundle: !(response.url && response.error !== undefined),
      kind: response.kind,
      url: response.url,
    }).toMatchObject({ classifiedWhenEmpty: true, errorFreeBundle: true });
  });

  /**
   * Line 4337 maps any kind outside these three to "failed", and line 4537
   * raises downloadFailed for a failure. Nothing we return is a plugin-side
   * failure: a misconfiguration is "blocked", and nothing-to-do is "up_to_date".
   */
  it.each(everyOutcome)("%s is never classified as a plugin failure", (_label, input) => {
    expect(["up_to_date", "blocked", undefined]).toContain(render(input).kind);
  });

  /**
   * Line 4551 calls `jsRes.getString("version")` unconditionally once a response
   * is not classified. A missing key throws, is caught as "error in update
   * check", and the good bundle is discarded.
   */
  it.each(everyOutcome)("%s sends version wherever version_name is sent", (label, input) => {
    const response = render(input);

    expect({
      case: label,
      mirrored: response.version_name === undefined || response.version === response.version_name,
      version: response.version,
      version_name: response.version_name,
    }).toMatchObject({ mirrored: true });
  });

  it("an OTA response satisfies everything the plugin reads to download", () => {
    const response = render(facts({ ota: bundle }));

    // The four the download path touches, in order: 4515, 4551, 4609.
    expect(response.kind).toBeUndefined();
    expect(response.error).toBeUndefined();
    expect(response.version).toBe("1.0.55");
    expect(response.url).toMatch(/^https:\/\/.+\.zip$/);
  });
});

describe("the wire response", () => {
  /**
   * The defect that cost the most: with autoUpdate "onlyDownload" the Capacitor
   * plugin downloads whatever sits in the top-level `url` and unzips it as a web
   * bundle. A native APK there made it fetch 45 MB, fail, and report "the update
   * could not be downloaded" while the real update sat unread in native_update.
   * Every curl test passed, because curl downloads an APK quite happily.
   */
  it("never puts a native binary in the OTA url field", () => {
    const response = render(facts({ native: android, ota: bundle }));

    expect(response.url).toBeUndefined();
    expect(response.native_update?.download_url).toBe(android.download_url);
    expect(response.message).toBe(UpdateMessage.NATIVE_UPDATE_AVAILABLE);
  });

  /**
   * `deploy ota --required` stored the flag and the response omitted it, so a
   * client offered "Later" on an update nobody was allowed to postpone.
   */
  it("carries required through to the device", () => {
    const response = render(facts({ ota: { ...bundle, required: true } }));

    expect(response.required).toBe(true);
    expect(resolveUpdate(response)?.required).toBe(true);
  });

  it("defaults required to false rather than leaving it absent", () => {
    expect(render(facts({ ota: { ...bundle, required: null } })).required).toBe(false);
  });

  it("carries release notes through to the device", () => {
    const response = render(facts({ ota: { ...bundle, release_notes: "Correctif" } }));

    expect(response.release_notes).toBe("Correctif");
    expect(resolveUpdate(response)?.releaseNotes).toBe("Correctif");
  });

  /**
   * The response used to spread the database row, so every device received the
   * internal primary key, the owning app's UUID, who uploaded it and the row
   * timestamps.
   */
  it("sends only contract fields for a native binary", () => {
    const payload = nativePayload({
      ...android,
      // Extra columns as they exist on the row.
      ...({ id: "row-uuid", app_id: "app-uuid", uploaded_by: "someone" } as object),
    });

    expect(Object.keys(payload).sort()).toEqual([
      "download_url",
      "file_size",
      "platform",
      "release_notes",
      "required",
      "version_code",
      "version_name",
    ]);
  });

  // Declared on the contract as `file_size`, stored as `file_size_bytes`, and
  // never mapped - so a client could not warn before spending 45 MB of someone's
  // mobile data.
  it("maps the stored byte count onto the contract field", () => {
    expect(nativePayload(android).file_size).toBe(47_464_813);
    expect(nativePayload({ ...android, file_size_bytes: null }).file_size).toBeUndefined();
  });

  it("names the three outcomes that used to share an empty response", () => {
    expect(render(facts()).message).toBe(UpdateMessage.NO_BUNDLE);

    const ios = {
      appId: "com.efficy.app",
      platform: "ios" as const,
      versionCode: 1,
      versionName: "builtin",
    };
    expect(render(facts({ device: ios, ota: bundle })).message).toBe(
      UpdateMessage.PLATFORM_MISMATCH,
    );

    expect(
      render(
        facts({
          device: {
            appId: "com.efficy.app",
            platform: "android",
            versionCode: 60,
            versionName: "9.9.9",
          },
          ota: bundle,
        }),
      ).message,
    ).toBe(UpdateMessage.NO_UPDATE);
  });

  it("reports a gate whose binary was never uploaded, rather than failing", () => {
    const decision = decideUpdate(facts({ ota: { ...bundle, min_update_version: "99" } }));
    const response = renderUpdateResponse(decision, { config: {}, gate: null });

    expect(response.message).toBe(UpdateMessage.NATIVE_UPDATE_REQUIRED);
    expect(response.native_update).toBeNull();
    expect(response.error).toBe("Native version 99 required. You have 60.");
  });

  it("carries config on every outcome that has a channel to resolve one for", () => {
    const config = { API_URL: "https://api.test" };
    const withConfig = (input: UpdateFacts) =>
      renderUpdateResponse(decideUpdate(input), { config });

    expect(withConfig(facts({ ota: bundle })).config).toEqual(config);
    expect(withConfig(facts({ native: android })).config).toEqual(config);
    expect(withConfig(facts()).config).toEqual(config);
    expect(
      withConfig(
        facts({
          device: {
            appId: "com.efficy.app.staging",
            platform: "android",
            versionCode: 60,
            versionName: "builtin",
          },
        }),
      ).config,
    ).toEqual(config);

    // No app and no channel means there is no environment to resolve config for.
    expect(withConfig(facts({ identity: null })).config).toBeUndefined();
    expect(withConfig(facts({ channel: null })).config).toBeUndefined();
  });
});

/**
 * The half that no API test covered: what the app does with what the server
 * sent. The server can be right and the client still act wrongly if the two
 * disagree about a field, which is how a native offer ended up being downloaded
 * as a web bundle.
 */
describe("what the client resolves each response to", () => {
  it("acts on a native offer as a native install", () => {
    const resolved = resolveUpdate(render(facts({ native: android, ota: bundle })));

    expect(resolved).toMatchObject({
      kind: "native",
      version: "1.0.56",
      versionCode: 67,
      downloadUrl: android.download_url,
      platform: "android",
    });
  });

  it("treats a required-native response as mandatory whatever the row says", () => {
    const decision = decideUpdate(facts({ ota: { ...bundle, min_update_version: "67" } }));
    const response = renderUpdateResponse(decision, {
      config: {},
      gate: { ...android, required: false },
    });

    expect(resolveUpdate(response)).toMatchObject({ kind: "native", required: true });
  });

  it("acts on a bundle offer as an OTA install", () => {
    expect(resolveUpdate(render(facts({ ota: bundle })))).toMatchObject({
      kind: "ota",
      version: "1.0.55",
      downloadUrl: bundle.url,
      checksum: "52a6d49b",
    });
  });

  it.each([
    ["no app", facts({ identity: null })],
    ["no channel", facts({ channel: null })],
    ["no bundle", facts()],
    [
      "a platform mismatch",
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "ios",
          versionCode: 1,
          versionName: "builtin",
        },
        ota: bundle,
      }),
    ],
    [
      "a flavour mismatch",
      facts({
        identity: { appId: "app-uuid", bundleId: "com.efficy.app.staging", flavour: "staging" },
        ota: bundle,
      }),
    ],
    [
      "a channel with the platform switched off",
      facts({
        channel: { name: "production", environment: "prod", androidEnabled: false },
        ota: bundle,
      }),
    ],
    [
      "an emulator on a channel that refuses them",
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: 60,
          versionName: "builtin",
          isEmulator: true,
        },
        channel: { name: "production", environment: "prod", allowEmulators: false },
        ota: bundle,
      }),
    ],
    [
      "a debuggable build on a channel that refuses them",
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: 60,
          versionName: "builtin",
          isProduction: false,
        },
        channel: { name: "production", environment: "prod", allowDevBuilds: false },
        ota: bundle,
      }),
    ],
    [
      "an up-to-date device",
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: 60,
          versionName: "9.9.9",
        },
        ota: bundle,
      }),
    ],
  ])("takes no action on %s", (_label, input) => {
    expect(resolveUpdate(render(input))).toBeNull();
  });
});
