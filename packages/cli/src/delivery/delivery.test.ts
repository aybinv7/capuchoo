import { describe, expect, it } from "vite-plus/test";
import type {
  AppArtefacts,
  BundleArtefact,
  ChannelRecord,
  NativeArtefact,
} from "../services/wire.js";
import { planClientChannel } from "./client-channel.js";
import { eligibleChannels, selectPointTargets } from "./point-targets.js";
import { describeMove, releaseRows } from "./release-rows.js";

function bundle(overrides: Partial<BundleArtefact>): BundleArtefact {
  return {
    id: "b",
    version_name: "2.4.0",
    platform: "android",
    flavour: "prod",
    created_at: "2026-09-10T00:00:00Z",
    ...overrides,
  };
}

function native(overrides: Partial<NativeArtefact>): NativeArtefact {
  return {
    id: "n",
    version_name: "2.4.0",
    version_code: 57,
    platform: "android",
    flavour: "prod",
    created_at: "2026-09-10T00:00:00Z",
    ...overrides,
  };
}

function channel(overrides: Partial<ChannelRecord>): ChannelRecord {
  return {
    id: "c-prod",
    name: "prod",
    app_id: "app",
    environment: "prod",
    public: false,
    created_at: "2026-09-01T00:00:00Z",
    kind: "release",
    ...overrides,
  };
}

const ARTEFACTS: AppArtefacts = {
  bundles: [
    bundle({ id: "b-240", eligible_channels: ["prod", "prod-acme"] }),
    bundle({ id: "b-240-dev", flavour: "dev" }),
    bundle({ id: "b-231", version_name: "2.3.1", created_at: "2026-09-01T00:00:00Z" }),
  ],
  native_builds: [native({ id: "n-57", eligible_channels: ["prod"] })],
};

const PROD = { name: "prod-acme", environment: "prod" as const };

describe("selectPointTargets", () => {
  it("picks the bundle of the channel's flavour", () => {
    const targets = selectPointTargets({
      artefacts: ARTEFACTS,
      channel: PROD,
      platform: "android",
      version: "2.4.0",
    });
    expect(targets).toEqual({ bundle: ARTEFACTS.bundles[0], native: null });
  });

  it("adds the native build with --native", () => {
    const targets = selectPointTargets({
      artefacts: ARTEFACTS,
      channel: PROD,
      platform: "android",
      version: "2.4.0",
      nativeCode: 57,
    });
    expect(targets.native?.id).toBe("n-57");
  });

  it("delivers a native build alone when --version is omitted", () => {
    const targets = selectPointTargets({
      artefacts: ARTEFACTS,
      channel: PROD,
      platform: "android",
      nativeCode: 57,
    });
    expect(targets.bundle).toBeNull();
    expect(targets.native?.id).toBe("n-57");
  });

  it("refuses when neither --version nor --native is given", () => {
    expect(() =>
      selectPointTargets({ artefacts: ARTEFACTS, channel: PROD, platform: "android" }),
    ).toThrow(/--version/);
  });

  it("points only the native pointer when the version has no bundle", () => {
    const artefacts = { bundles: [], native_builds: ARTEFACTS.native_builds };
    const targets = selectPointTargets({
      artefacts,
      channel: PROD,
      platform: "android",
      version: "2.4.0",
      nativeCode: 57,
    });
    expect(targets).toEqual({ bundle: null, native: ARTEFACTS.native_builds[0] });
  });

  it("refuses a native build whose version disagrees with --version", () => {
    expect(() =>
      selectPointTargets({
        artefacts: ARTEFACTS,
        channel: PROD,
        platform: "android",
        version: "2.3.1",
        nativeCode: 57,
      }),
    ).toThrow("Native build 57 is version 2.4.0, not 2.3.1");
  });

  it("names the newest versions when nothing matches", () => {
    expect(() =>
      selectPointTargets({
        artefacts: ARTEFACTS,
        channel: PROD,
        platform: "android",
        version: "9.9.9",
      }),
    ).toThrow("Newest: 2.4.0, 2.3.1");
  });

  it("explains a version that exists only for another flavour", () => {
    expect(() =>
      selectPointTargets({
        artefacts: { bundles: [bundle({ flavour: "staging" })], native_builds: [] },
        channel: PROD,
        platform: "android",
        version: "2.4.0",
      }),
    ).toThrow("exists only for the staging flavour");
  });
});

describe("eligibleChannels", () => {
  it("is the intersection of what each target may be pointed at", () => {
    expect(
      eligibleChannels({ bundle: ARTEFACTS.bundles[0]!, native: ARTEFACTS.native_builds[0]! }),
    ).toEqual(["prod"]);
  });

  it("is null when the server did not say", () => {
    expect(eligibleChannels({ bundle: bundle({}), native: null })).toBeNull();
  });
});

describe("planClientChannel", () => {
  const channels = [
    channel({}),
    channel({ id: "c-acme", name: "prod-acme", kind: "client", base_channel_id: "c-prod" }),
  ];

  it("inherits the base channel's environment", () => {
    const plan = planClientChannel({
      name: "prod-beta",
      baseName: "prod",
      environment: undefined,
      channels,
    });
    expect(plan).toEqual({ environment: "prod", base: channels[0] });
  });

  it.each([
    [{ baseName: undefined }, "Pass --base"],
    [{ baseName: "nope" }, 'No channel "nope"'],
    [{ baseName: "prod-acme" }, "is itself a client channel"],
    [{ baseName: "prod", environment: "staging" as const }, "Drop --environment"],
  ])("refuses %o", (overrides, message) => {
    expect(() =>
      planClientChannel({
        name: "prod-beta",
        baseName: "prod",
        environment: undefined,
        channels,
        ...overrides,
      }),
    ).toThrow(message);
  });
});

describe("releaseRows", () => {
  const artefacts: AppArtefacts = {
    bundles: [
      bundle({ id: "b1", created_at: "2026-09-02T00:00:00Z", channels: ["prod"] }),
      bundle({ id: "b2", created_at: "2026-09-05T00:00:00Z", channels: [] }),
    ],
    native_builds: [native({ id: "n1", created_at: "2026-09-03T00:00:00Z", channels: ["prod"] })],
  };

  it("merges both kinds newest first", () => {
    expect(releaseRows(artefacts).map((row) => row.id)).toEqual(["b2", "n1", "b1"]);
  });

  it("filters to a channel and marks what it serves now", () => {
    const rows = releaseRows(artefacts, channel({ current_bundle_id: "b2" }));
    expect(rows.map((row) => [row.id, row.current])).toEqual([
      ["b2", true],
      ["n1", false],
      ["b1", false],
    ]);
  });
});

describe("describeMove", () => {
  it("reads as one line", () => {
    expect(
      describeMove({
        id: "m",
        created_at: "2026-09-10T12:30:00.000Z",
        action: "rollback",
        bundle_id: "b",
        version_name: "2.3.1",
        actor_email: "ops@example.com",
        reason: "crash on login",
      }),
    ).toBe(
      "2026-09-10 12:30:00  rollback  ota 2.3.1                   ops@example.com  - crash on login",
    );
  });
});
