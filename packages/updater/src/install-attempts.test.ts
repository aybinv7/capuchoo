import { describe, expect, it } from "vite-plus/test";
import { isInstallAbandoned, parseInstallRecord, settleInstall } from "./install-attempts.js";

describe("settleInstall", () => {
  it("reports an install once the installed build reaches the offered one", () => {
    expect(
      settleInstall({ offeredVersionCode: 70, installedVersionCode: 70, record: null }),
    ).toEqual({
      settlement: { kind: "installed" },
      record: null,
    });
  });

  it("counts a first failure without giving up", () => {
    expect(
      settleInstall({ offeredVersionCode: 70, installedVersionCode: 60, record: null }),
    ).toEqual({
      settlement: { kind: "not-installed", failures: 1, abandoned: false },
      record: { versionCode: 70, failures: 1 },
    });
  });

  it("gives up on the second failure of the same version", () => {
    const { settlement } = settleInstall({
      offeredVersionCode: 70,
      installedVersionCode: 60,
      record: { versionCode: 70, failures: 1 },
    });

    expect(settlement).toEqual({ kind: "not-installed", failures: 2, abandoned: true });
  });

  it("starts counting again for a different version", () => {
    const { settlement } = settleInstall({
      offeredVersionCode: 71,
      installedVersionCode: 60,
      record: { versionCode: 70, failures: 5 },
    });

    expect(settlement).toMatchObject({ failures: 1, abandoned: false });
  });
});

describe("isInstallAbandoned", () => {
  it("applies only to the version that failed", () => {
    const record = { versionCode: 70, failures: 2 };

    expect(isInstallAbandoned(record, 70)).toBe(true);
    expect(isInstallAbandoned(record, 71)).toBe(false);
    expect(isInstallAbandoned({ versionCode: 70, failures: 1 }, 70)).toBe(false);
    expect(isInstallAbandoned(null, 70)).toBe(false);
  });
});

describe("parseInstallRecord", () => {
  it.each([null, "", "not json", '{"versionCode":"70","failures":1}', '{"versionCode":70}'])(
    "rejects %j",
    (raw) => {
      expect(parseInstallRecord(raw)).toBeNull();
    },
  );

  it("reads a well-formed record", () => {
    expect(parseInstallRecord('{"versionCode":70,"failures":2}')).toEqual({
      versionCode: 70,
      failures: 2,
    });
  });
});
