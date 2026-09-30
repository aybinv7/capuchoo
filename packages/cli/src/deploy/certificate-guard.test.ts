import { describe, expect, it } from "vite-plus/test";
import type { NativeArtefact } from "../services/wire.js";
import { checkCertificate, previousNativeRelease } from "./certificate-guard.js";

const A = "a".repeat(64);
const B = "b".repeat(64);
const PROD = { name: "prod", environment: "prod" as const, kind: "release" as const };
const DEV = { name: "dev", environment: "dev" as const, kind: "release" as const };

function native(overrides: Partial<NativeArtefact>): NativeArtefact {
  return {
    id: "n1",
    version_name: "1.0.0",
    version_code: 10,
    platform: "android",
    flavour: "prod",
    created_at: "2026-09-01T00:00:00Z",
    signing_cert_sha256: A,
    ...overrides,
  };
}

describe("previousNativeRelease", () => {
  it("picks the highest build number of the same flavour and platform", () => {
    const builds = [
      native({ id: "old", version_code: 9 }),
      native({ id: "new", version_code: 12 }),
      native({ id: "dev", version_code: 30, flavour: "dev" }),
      native({ id: "ios", version_code: 40, platform: "ios" }),
    ];
    expect(previousNativeRelease(builds, "android", "prod")?.id).toBe("new");
  });

  it("is null for a first release", () => {
    expect(previousNativeRelease([], "android", "prod")).toBeNull();
  });
});

describe("checkCertificate", () => {
  it("accepts a matching certificate", () => {
    expect(
      checkCertificate({ channel: PROD, current: A, previous: native({}), allowChange: false }),
    ).toEqual({ ok: true });
  });

  it("compares case-insensitively against what the server stored", () => {
    const previous = native({ signing_cert_sha256: A.toUpperCase() });
    expect(checkCertificate({ channel: PROD, current: A, previous, allowChange: false }).ok).toBe(
      true,
    );
  });

  it("refuses a changed certificate", () => {
    const verdict = checkCertificate({
      channel: PROD,
      current: B,
      previous: native({}),
      allowChange: false,
    });
    expect(verdict).toMatchObject({
      ok: false,
      message: expect.stringMatching(/1\.0\.0 \(build 10\)[\s\S]*--allow-cert-change/),
    });
  });

  it("publishes a changed certificate with --allow-cert-change, and says so", () => {
    const verdict = checkCertificate({
      channel: PROD,
      current: B,
      previous: native({}),
      allowChange: true,
    });
    expect(verdict).toMatchObject({
      ok: true,
      warning: expect.stringContaining("--allow-cert-change"),
    });
  });

  it("has nothing to compare on a first release or a release that predates pinning", () => {
    expect(
      checkCertificate({ channel: PROD, current: B, previous: null, allowChange: false }),
    ).toEqual({ ok: true });
    expect(
      checkCertificate({
        channel: PROD,
        current: B,
        previous: native({ signing_cert_sha256: null }),
        allowChange: false,
      }),
    ).toEqual({ ok: true });
  });

  it("refuses an unreadable certificate on a protected channel only", () => {
    expect(
      checkCertificate({ channel: PROD, current: null, previous: null, allowChange: false }).ok,
    ).toBe(false);
    expect(
      checkCertificate({ channel: DEV, current: null, previous: null, allowChange: false }),
    ).toMatchObject({ ok: true });
  });
});
