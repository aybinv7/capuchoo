import { generateReleaseKeyPair, verifyRelease, type UserProfile } from "@capuchoo/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ResolvedFlavour } from "../pipeline/flavour.js";
import type { CloudClient } from "../services/cloud.js";
import type { ChannelRecord } from "../services/wire.js";
import { writeReleaseKey } from "../signing/release-key.js";
import { releasePreflight, type PreflightInput } from "./preflight.js";
import { needsSeal, sealArtefact } from "./seal.js";

let appDir: string;

const FLAVOUR: ResolvedFlavour = {
  environment: "prod",
  config: { envFile: "build/prod/.env.prod" },
  envFile: "build/prod/.env.prod",
  trapezeConfig: null,
  assetPath: null,
  fileEnv: {},
  mode: "prod",
};

function channel(overrides: Partial<ChannelRecord> = {}): ChannelRecord {
  return {
    id: "c1",
    name: "prod",
    app_id: "app-1",
    environment: "prod",
    public: false,
    created_at: "2026-09-01T00:00:00Z",
    kind: "release",
    ...overrides,
  };
}

function profile(app: Record<string, unknown> = {}): UserProfile {
  return {
    user: { id: "u", email: "dev@example.com" },
    organizations: [],
    apps: [{ id: "app-1", role: "admin", ...app } as UserProfile["apps"][number]],
  };
}

function input(overrides: Partial<PreflightInput> = {}): PreflightInput {
  return {
    appDir,
    cloudAppId: "app-1",
    kind: "ota",
    platform: "android",
    channel: channel(),
    flavour: FLAVOUR,
    profile: profile(),
    cloud: { artefacts: vi.fn(async () => ({ bundles: [], native_builds: [] })) } as never,
    ...overrides,
  };
}

beforeEach(() => {
  appDir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-preflight-"));
  vi.stubEnv("CAPUCHOO_SIGNING_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(appDir, { recursive: true, force: true });
});

describe("releasePreflight", () => {
  it("refuses an upload to a client channel and says how to deliver instead", async () => {
    const result = await releasePreflight(
      input({ channel: channel({ name: "prod-acme", kind: "client" }) }),
    );
    expect(result.problems[0]).toContain("capuchoo channel point prod-acme");
  });

  it("refuses a prod deploy without a key when the app requires signatures", async () => {
    const result = await releasePreflight(input({ profile: profile({ require_signature: true }) }));
    expect(result.key).toBeNull();
    expect(result.problems[0]).toContain("only accepts signed releases");
  });

  it("loads the key and fetches history only for native Android", async () => {
    writeReleaseKey(appDir, (await generateReleaseKeyPair()).privateKey);
    const cloud = { artefacts: vi.fn(async () => ({ bundles: [], native_builds: [] })) };

    const ota = await releasePreflight(input({ cloud: cloud as unknown as CloudClient }));
    expect(ota.key?.source).toBe("file");
    expect(ota.artefacts).toBeNull();
    expect(cloud.artefacts).not.toHaveBeenCalled();

    const native = await releasePreflight(
      input({ kind: "native", cloud: cloud as unknown as CloudClient }),
    );
    expect(native.artefacts).toEqual({ bundles: [], native_builds: [] });
  });

  it("reports an unusable key as a problem rather than crashing later", async () => {
    vi.stubEnv("CAPUCHOO_SIGNING_KEY", "garbage");
    const result = await releasePreflight(input());
    expect(result.problems[0]).toContain("CAPUCHOO_SIGNING_KEY is not a P-256");
  });
});

describe("sealArtefact", () => {
  it("signs an OTA bundle so the server and the updater can verify it", async () => {
    const pair = await generateReleaseKeyPair();
    writeReleaseKey(appDir, pair.privateKey);
    const { key } = await releasePreflight(input());
    const zip = path.join(appDir, "bundle.zip");
    fs.writeFileSync(zip, "bytes");

    expect(needsSeal("ota", "android", key)).toBe(true);
    expect(needsSeal("ota", "android", null)).toBe(false);

    const seal = await sealArtefact({
      artifact: { kind: "ota", filePath: zip, byteSize: 5 },
      channel: channel(),
      platform: "android",
      androidDir: appDir,
      artefacts: null,
      allowCertChange: false,
      logFile: path.join(appDir, "log"),
      key,
      appId: "com.example.app",
      version: "1.0.0",
      versionCode: 3,
    });

    expect(seal.signingCertSha256).toBeUndefined();
    const valid = await verifyRelease(
      {
        kind: "ota",
        appId: "com.example.app",
        platform: "android",
        version: "1.0.0",
        sha256: seal.sha256!,
      },
      seal.signature,
      pair.publicKey,
    );
    expect(valid).toBe(true);
  });
});
