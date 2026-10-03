import { describe, expect, it } from "vite-plus/test";
import {
  decodeRecordingHeader,
  encodeRecordingHeader,
  parseRecordingAssetHeader,
  parseRecordingPolicyRequest,
  parseRecordingSegmentHeader,
} from "./recording-wire.js";

const SESSION = "0190a8d2-7c1e-7b3a-9f00-1234567890ab";

const session = {
  sessionId: SESSION,
  appId: "com.acme.app",
  deviceId: "d-1",
  platform: "android",
  versionName: "3.0.1",
  versionCode: 42,
  channel: "prod",
  start: "shake",
  mode: "session",
  startedAt: 1000,
  recorder: "0.1.0",
  device: { model: "Pixel", screen: { width: 412, height: 915, dpr: 2.6 } },
  note: "la commande ne passe pas — لا يعمل",
};

const segment = {
  sessionId: SESSION,
  seq: 0,
  startedAt: 1000,
  endedAt: 6000,
  events: 120,
  bytes: 90_000,
  fullSnapshot: true,
  errors: 1,
  final: false,
};

describe("recording header codec", () => {
  it("round-trips any script through a Latin-1 header", () => {
    const encoded = encodeRecordingHeader({ session, segment });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeRecordingHeader(encoded)).toEqual({ session, segment });
  });

  it("is null for garbage and oversize input", () => {
    expect(decodeRecordingHeader("%%%")).toBeNull();
    expect(decodeRecordingHeader("a".repeat(9000))).toBeNull();
    expect(decodeRecordingHeader(null)).toBeNull();
  });
});

describe("parseRecordingSegmentHeader", () => {
  it("parses a valid header", () => {
    const parsed = parseRecordingSegmentHeader(encodeRecordingHeader({ session, segment }));
    expect(parsed?.session).toMatchObject({
      sessionId: SESSION,
      start: "shake",
      note: session.note,
      device: { model: "Pixel", manufacturer: null, screen: { width: 412, height: 915, dpr: 2.6 } },
    });
    expect(parsed?.segment).toEqual(segment);
  });

  it("refuses a segment that names another session", () => {
    const other = { ...segment, sessionId: "0190a8d2-7c1e-7b3a-9f00-000000000000" };
    expect(
      parseRecordingSegmentHeader(encodeRecordingHeader({ session, segment: other })),
    ).toBeNull();
  });

  it("refuses a malformed session id, mode or time range", () => {
    for (const bad of [
      { session: { ...session, sessionId: "../../etc" }, segment },
      { session: { ...session, mode: "loud" }, segment },
      { session, segment: { ...segment, endedAt: 10 } },
      { session, segment: { ...segment, seq: -1 } },
    ]) {
      expect(parseRecordingSegmentHeader(encodeRecordingHeader(bad))).toBeNull();
    }
  });
});

describe("parseRecordingAssetHeader", () => {
  const asset = {
    appId: "com.acme.app",
    versionName: "3.0.1",
    path: "/assets/index-4f2a.css",
    sha256: "a".repeat(64),
    contentType: "text/css",
  };

  it("parses a valid asset", () => {
    expect(parseRecordingAssetHeader(encodeRecordingHeader(asset))).toEqual(asset);
  });

  it("refuses a relative path or a bad hash", () => {
    expect(
      parseRecordingAssetHeader(encodeRecordingHeader({ ...asset, path: "assets/x.css" })),
    ).toBeNull();
    expect(
      parseRecordingAssetHeader(encodeRecordingHeader({ ...asset, sha256: "xyz" })),
    ).toBeNull();
  });
});

describe("parseRecordingPolicyRequest", () => {
  it("defaults the version to builtin and requires identity", () => {
    expect(
      parseRecordingPolicyRequest({ appId: "a", deviceId: "d", platform: "android" }),
    ).toMatchObject({ versionName: "builtin", known: null, channel: null });
    expect(parseRecordingPolicyRequest({ appId: "a", platform: "android" })).toBeNull();
  });
});
