import type { ResolvedUpdate } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";
import { isSameArtefact, mergeUpdate } from "./update-merge.js";

const ota: ResolvedUpdate = {
  kind: "ota",
  version: "1.4.1",
  downloadUrl: "https://cdn.test/b.zip?sig=1",
  required: true,
  checksum: "aa",
  signature: "sig",
};
const native: ResolvedUpdate = {
  kind: "native",
  version: "1.5.0",
  versionCode: 70,
  required: false,
};

describe("isSameArtefact", () => {
  it("compares kind, version and native build number", () => {
    expect(isSameArtefact(ota, { ...ota, required: false })).toBe(true);
    expect(isSameArtefact(ota, { ...ota, version: "1.4.2" })).toBe(false);
    expect(isSameArtefact(native, { ...native, versionCode: 71 })).toBe(false);
    expect(isSameArtefact(native, { ...ota, version: "1.5.0" })).toBe(false);
  });
});

describe("mergeUpdate from the server", () => {
  it("takes the server's facts for the same artefact and keeps the downloaded bundle", () => {
    const result = mergeUpdate({
      current: { ...ota, bundleId: "b1" },
      incoming: { ...ota, downloadUrl: "https://cdn.test/b.zip?sig=2", required: false },
      source: "server",
      busy: true,
    });

    expect(result).toEqual({
      action: "merge",
      update: {
        ...ota,
        downloadUrl: "https://cdn.test/b.zip?sig=2",
        required: false,
        bundleId: "b1",
      },
    });
  });

  it("replaces a different artefact when nothing is in flight", () => {
    expect(mergeUpdate({ current: ota, incoming: native, source: "server", busy: false })).toEqual({
      action: "replace",
      update: native,
    });
  });

  it("never swaps an artefact that is downloading or with the installer", () => {
    expect(mergeUpdate({ current: native, incoming: ota, source: "server", busy: true })).toEqual({
      action: "ignore",
    });
  });
});

describe("mergeUpdate from the plugin", () => {
  const event: ResolvedUpdate = {
    kind: "ota",
    version: "1.4.1",
    bundleId: "b1",
    required: false,
    checksum: "AA",
  };

  it("only attaches the bundle id, never touching required", () => {
    expect(mergeUpdate({ current: ota, incoming: event, source: "plugin", busy: false })).toEqual({
      action: "merge",
      update: { ...ota, bundleId: "b1" },
    });
  });

  it.each([
    ["differs from", "bb"],
    ["is missing from", undefined],
  ])("refuses a bundle whose checksum %s the server's", (_label, checksum) => {
    expect(
      mergeUpdate({
        current: ota,
        incoming: { ...event, checksum },
        source: "plugin",
        busy: false,
      }),
    ).toEqual({ action: "ignore" });
  });

  it("drops a plugin bundle the server's checksum later disowns", () => {
    const pluginOnly: ResolvedUpdate = { ...event, checksum: "bb" };

    expect(
      mergeUpdate({ current: pluginOnly, incoming: ota, source: "server", busy: false }),
    ).toEqual({ action: "merge", update: ota });
  });

  it("never displaces a native update", () => {
    expect(
      mergeUpdate({
        current: native,
        incoming: { ...event, version: "9.0.0" },
        source: "plugin",
        busy: false,
      }),
    ).toEqual({ action: "ignore" });
  });

  it("carries required over to a newer bundle it found", () => {
    expect(
      mergeUpdate({
        current: ota,
        incoming: { ...event, version: "1.4.2" },
        source: "plugin",
        busy: false,
      }),
    ).toEqual({ action: "replace", update: { ...event, version: "1.4.2", required: true } });
  });
});
