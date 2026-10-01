import { describe, expect, it } from "vite-plus/test";
import { describePrebuiltProblems, type PrebuiltFacts } from "./prebuilt-apk.js";

function facts(overrides: Partial<PrebuiltFacts> = {}): PrebuiltFacts {
  return {
    file: "app-release.apk",
    manifest: {
      applicationId: "com.example.field",
      versionCode: 13,
      versionName: "1.4.0",
      minSdk: 26,
      debuggable: false,
    },
    signed: true,
    channel: { name: "prod", environment: "prod", kind: "release" },
    identifiers: [{ bundle_id: "com.example.field", flavour: null }],
    artefacts: {
      bundles: [],
      native_builds: [
        {
          id: "n1",
          version_name: "1.3.0",
          version_code: 12,
          platform: "android",
          flavour: "prod",
          created_at: "",
        },
      ],
    },
    allowUnsigned: false,
    ...overrides,
  };
}

describe("describePrebuiltProblems", () => {
  it("accepts a signed release build above what the channel's flavour holds", () => {
    expect(describePrebuiltProblems(facts())).toEqual([]);
  });

  it("refuses a build number devices would not install over the last one", () => {
    const [problem] = describePrebuiltProblems(
      facts({ manifest: { ...facts().manifest, versionCode: 12 } }),
    );
    expect(problem).toContain("not above build 12");
    expect(problem).toContain("versionCode 13 or more");
  });

  it("keeps debug and unsigned builds off field devices", () => {
    const debug = facts({ manifest: { ...facts().manifest, debuggable: true } });
    expect(describePrebuiltProblems(debug)[0]).toContain("debuggable build");
    expect(describePrebuiltProblems(facts({ signed: false }))[0]).toContain("not signed");
    const client = facts({
      manifest: { ...facts().manifest, debuggable: true },
      channel: { name: "prod-acme", environment: "prod", kind: "client" },
    });
    expect(describePrebuiltProblems(client)[0]).toContain("client");
  });

  it("lets a dev channel take a debug build, and an unsigned one only when asked", () => {
    const dev = { name: "dev", environment: "dev", kind: "release" } as const;
    const debug = { ...facts().manifest, debuggable: true };
    expect(describePrebuiltProblems(facts({ channel: dev, manifest: debug }))).toEqual([]);
    expect(describePrebuiltProblems(facts({ channel: dev, signed: false }))[0]).toContain(
      "--allow-unsigned",
    );
    expect(
      describePrebuiltProblems(facts({ channel: dev, signed: false, allowUnsigned: true })),
    ).toEqual([]);
  });

  it("names the command when the applicationId is not registered", () => {
    const [problem] = describePrebuiltProblems(facts({ identifiers: [] }));
    expect(problem).toContain("capuchoo app identifier add com.example.field --flavour prod");
    expect(describePrebuiltProblems(facts({ identifiers: undefined }))).toEqual([]);
  });

  it("refuses an identifier registered for another flavour", () => {
    const [problem] = describePrebuiltProblems(
      facts({ identifiers: [{ bundle_id: "com.example.field", flavour: "dev" }] }),
    );
    expect(problem).toContain('Channel "prod" serves prod builds');
  });
});
