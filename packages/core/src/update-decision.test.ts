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
    expect(decideUpdate(facts({ native: android }))).toMatchObject({
      kind: "native",
      release: { version_code: 67 },
    });
  });

  it("serves a required native binary ahead of a servable bundle", () => {
    expect(
      decideUpdate(facts({ native: { ...android, required: true }, ota: bundle })),
    ).toMatchObject({ kind: "native", release: { version_code: 67 } });
  });

  it("serves the bundle and attaches an optional native binary", () => {
    expect(decideUpdate(facts({ native: android, ota: bundle }))).toMatchObject({
      kind: "ota",
      release: { version_name: "1.0.55" },
      native: { version_code: 67 },
    });
  });

  it.each([
    ["is up to date", { ...facts().device, versionName: "9.9.9" }, bundle],
    ["is gated behind a newer binary", facts().device, { ...bundle, min_update_version: "67" }],
  ])("offers an optional native binary alone when the bundle %s", (_label, device, ota) => {
    expect(decideUpdate(facts({ device, native: android, ota }))).toMatchObject({
      kind: "native",
      release: { version_code: 67 },
    });
  });

  it("does not offer a native binary to a device that reports no build number", () => {
    const device = { ...facts().device, versionCode: 0 };

    expect(decideUpdate(facts({ device, native: android }))).toEqual({ kind: "no-bundle" });
    expect(decideUpdate(facts({ device, native: android, ota: bundle }))).toEqual({
      kind: "ota",
      release: bundle,
    });
    expect(
      decideUpdate(facts({ device, native: { ...android, required: true }, ota: bundle })),
    ).toEqual({ kind: "ota", release: bundle });
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

  describe("a device on its builtin bundle", () => {
    const onBuiltin = (builtinVersion: string | undefined, versionCode = 70) =>
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode,
          versionName: "builtin",
          builtinVersion,
        },
        ota: { ...bundle, version_name: "1.4.0" },
      });

    it.each([
      ["an older bundle after a native install", "1.5.0", { kind: "up-to-date", version: "1.5.0" }],
      ["the bundle equal to its binary", "1.4.0", { kind: "up-to-date", version: "1.4.0" }],
      ["a newer bundle after a native install", "1.3.9", { kind: "ota" }],
      ["a bundle when the binary version is unparseable", "1.5", { kind: "ota" }],
      ["a bundle when the binary version is absent", undefined, { kind: "ota" }],
      ["a bundle when the binary version is blank", "  ", { kind: "ota" }],
    ])("is served %s accordingly", (_label, builtinVersion, expected) => {
      expect(decideUpdate(onBuiltin(builtinVersion))).toMatchObject(expected);
    });

    it("ignores builtinVersion once a bundle has been applied", () => {
      const decision = decideUpdate(
        facts({
          device: {
            appId: "com.efficy.app",
            platform: "android",
            versionCode: 70,
            versionName: "1.3.0",
            builtinVersion: "1.5.0",
          },
          ota: { ...bundle, version_name: "1.4.0" },
        }),
      );

      expect(decision).toMatchObject({ kind: "ota" });
    });
  });

  it("orders prerelease identifiers numerically", () => {
    const decision = decideUpdate(
      facts({
        device: {
          appId: "com.efficy.app",
          platform: "android",
          versionCode: 60,
          versionName: "1.0.55-beta.2",
        },
        ota: { ...bundle, version_name: "1.0.55-beta.10" },
      }),
    );

    expect(decision).toMatchObject({ kind: "ota" });
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
    [
      "channel-paused",
      facts({ channel: { name: "production", environment: "prod", paused: true }, ota: bundle }),
    ],
    ["native", facts({ native: android })],
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

  it.each([
    ["a plain bundle", facts({ ota: bundle })],
    ["a bundle with an optional native offer", facts({ native: android, ota: bundle })],
    [
      "a downgrade",
      facts({
        device: { ...facts().device, versionName: "1.0.56" },
        channel: { name: "production", environment: "prod", allowDowngrade: true },
        ota: bundle,
      }),
    ],
  ])("an OTA response for %s satisfies everything the plugin reads", (_label, input) => {
    const response = render(input);

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
    const response = render(facts({ native: android }));

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
    const resolved = resolveUpdate(render(facts({ native: android })));

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

describe("pause and rollback", () => {
  const paused = { name: "production", environment: "prod" as const, paused: true };
  const rolledBack = { name: "production", environment: "prod" as const, allowDowngrade: true };
  const onVersion = (versionName: string) => ({ ...facts().device, versionName });

  it("serves nothing from a paused channel, not even a required native binary", () => {
    const decision = decideUpdate(
      facts({ channel: paused, native: { ...android, required: true }, ota: bundle }),
    );

    expect(decision).toMatchObject({ kind: "channel-paused" });
  });

  it("checks pause before the device gates", () => {
    const decision = decideUpdate(
      facts({
        device: { ...facts().device, isEmulator: true },
        channel: { ...paused, allowEmulators: false, androidEnabled: false },
        ota: bundle,
      }),
    );

    expect(decision.kind).toBe("channel-paused");
  });

  it("renders a pause as blocked, with config and nothing to download", () => {
    const config = { API_URL: "https://api.test" };
    const response = renderUpdateResponse(decideUpdate(facts({ channel: paused, ota: bundle })), {
      config,
    });

    expect(response).toEqual({ message: UpdateMessage.CHANNEL_PAUSED, kind: "blocked", config });
    expect(resolveUpdate(response)).toBeNull();
  });

  it("serves an older bundle as a downgrade on a rolled-back channel", () => {
    const decision = decideUpdate(
      facts({ device: onVersion("1.0.56"), channel: rolledBack, ota: bundle }),
    );

    expect(decision).toEqual({ kind: "ota", release: bundle, downgrade: true });
  });

  it("keeps the device where it is on a channel that does not allow downgrades", () => {
    expect(decideUpdate(facts({ device: onVersion("1.0.56"), ota: bundle }))).toMatchObject({
      kind: "up-to-date",
    });
  });

  it("treats an equal version as up to date even when downgrades are allowed", () => {
    expect(
      decideUpdate(facts({ device: onVersion("1.0.55"), channel: rolledBack, ota: bundle })),
    ).toMatchObject({ kind: "up-to-date" });
  });

  it("never downgrades a binary's own builtin bundle", () => {
    const device = { ...facts().device, versionCode: 70, builtinVersion: "1.0.60" };

    expect(decideUpdate(facts({ device, channel: rolledBack, ota: bundle }))).toMatchObject({
      kind: "up-to-date",
    });
  });

  it("still applies the native gate to a downgrade", () => {
    const decision = decideUpdate(
      facts({
        device: onVersion("1.0.56"),
        channel: rolledBack,
        ota: { ...bundle, min_update_version: "67" },
      }),
    );

    expect(decision.kind).toBe("native-required");
  });

  it("marks the wire response and the resolved update as a downgrade", () => {
    const response = render(
      facts({ device: onVersion("1.0.56"), channel: rolledBack, ota: bundle }),
    );

    expect(response.downgrade).toBe(true);
    expect(resolveUpdate(response)).toMatchObject({ kind: "ota", downgrade: true });
    expect("downgrade" in render(facts({ ota: bundle }))).toBe(false);
  });
});

describe("signatures and the optional native offer on the wire", () => {
  const sha = "a".repeat(64);
  const signedBundle: OtaRelease = {
    ...bundle,
    checksum: sha,
    signature: "ota-sig",
    app_id: "com.efficy.app",
  };
  const signedNative: NativeRelease = {
    ...android,
    checksum: "b".repeat(64),
    signature: "apk-sig",
  };

  it("carries the OTA signature and primary bundle id", () => {
    const response = render(facts({ ota: signedBundle }));

    expect(response).toMatchObject({
      signature: "ota-sig",
      app_id: "com.efficy.app",
      checksum: sha,
    });
    expect(resolveUpdate(response)).toMatchObject({
      kind: "ota",
      signature: "ota-sig",
      appId: "com.efficy.app",
      checksum: sha,
    });
  });

  it("prefers the context's primary bundle id over the release's", () => {
    const response = renderUpdateResponse(decideUpdate(facts({ ota: signedBundle })), {
      config: {},
      appId: "com.efficy.primary",
    });

    expect(response.app_id).toBe("com.efficy.primary");
  });

  it("carries the native checksum and signature, and the primary bundle id", () => {
    const response = renderUpdateResponse(decideUpdate(facts({ native: signedNative })), {
      config: {},
      appId: "com.efficy.app",
    });

    expect(response.native_update).toMatchObject({
      checksum: "b".repeat(64),
      signature: "apk-sig",
    });
    expect(response.app_id).toBe("com.efficy.app");
    expect(resolveUpdate(response)).toMatchObject({
      kind: "native",
      checksum: "b".repeat(64),
      signature: "apk-sig",
      appId: "com.efficy.app",
    });
  });

  it("carries the gate's checksum and signature on a native-required response", () => {
    const decision = decideUpdate(facts({ ota: { ...bundle, min_update_version: "67" } }));
    const response = renderUpdateResponse(decision, {
      config: {},
      gate: signedNative,
      appId: "com.efficy.app",
    });

    expect(response.native_update).toMatchObject({ signature: "apk-sig" });
    expect(response.app_id).toBe("com.efficy.app");
  });

  it("omits every signing field when nothing was signed", () => {
    const response = render(facts({ ota: bundle }));

    expect("signature" in response).toBe(false);
    expect("app_id" in response).toBe(false);
    expect("checksum" in nativePayload(android)).toBe(false);
    expect("signature" in nativePayload(android)).toBe(false);
  });

  it("offers an optional native binary alongside the bundle it does not hide", () => {
    const response = render(facts({ native: signedNative, ota: signedBundle }));

    expect(response.url).toBe(bundle.url);
    expect(response.native_update).toMatchObject({ version_code: 67, required: false });
    expect(resolveUpdate(response)).toMatchObject({
      kind: "ota",
      version: "1.0.55",
      nativeOffer: { kind: "native", versionCode: 67, required: false, signature: "apk-sig" },
    });
  });
});
