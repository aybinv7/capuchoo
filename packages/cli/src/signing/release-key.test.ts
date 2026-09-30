import { generateReleaseKeyPair, verifyRelease } from "@capuchoo/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  loadReleaseKey,
  SIGNING_KEY_FILE,
  toPrivateKeyPem,
  writeReleaseKey,
} from "./release-key.js";
import { sha256File, signReleaseFile } from "./release-signature.js";

let pair: { privateKey: string; publicKey: string };
let appDir: string;

beforeAll(async () => {
  pair = await generateReleaseKeyPair();
});

beforeEach(() => {
  appDir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-key-"));
});

afterEach(() => {
  fs.rmSync(appDir, { recursive: true, force: true });
});

describe("loadReleaseKey", () => {
  it("is null when there is no key anywhere", async () => {
    expect(await loadReleaseKey(appDir, {})).toBeNull();
  });

  it("round-trips the pem file written by keys init", async () => {
    writeReleaseKey(appDir, pair.privateKey);
    const key = await loadReleaseKey(appDir, {});
    expect(key).toMatchObject({ source: "file", publicKey: pair.publicKey });
    expect(key?.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(fs.readFileSync(path.join(appDir, SIGNING_KEY_FILE), "utf8")).toMatch(
      /^-----BEGIN PRIVATE KEY-----\n(.{1,64}\n)+-----END PRIVATE KEY-----\n$/,
    );
  });

  it("prefers CAPUCHOO_SIGNING_KEY over the file, as base64 or PEM", async () => {
    writeReleaseKey(appDir, (await generateReleaseKeyPair()).privateKey);
    const fromBase64 = await loadReleaseKey(appDir, { CAPUCHOO_SIGNING_KEY: pair.privateKey });
    const fromPem = await loadReleaseKey(appDir, {
      CAPUCHOO_SIGNING_KEY: toPrivateKeyPem(pair.privateKey),
    });
    expect(fromBase64).toMatchObject({ source: "environment", publicKey: pair.publicKey });
    expect(fromPem?.publicKey).toBe(pair.publicKey);
  });

  it("names the source of an unusable key", async () => {
    await expect(loadReleaseKey(appDir, { CAPUCHOO_SIGNING_KEY: "bm90IGEga2V5" })).rejects.toThrow(
      "CAPUCHOO_SIGNING_KEY is not a P-256 PKCS#8 private key",
    );
  });

  it.skipIf(process.platform === "win32")("writes the key owner-only", () => {
    const file = writeReleaseKey(appDir, pair.privateKey);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });
});

describe("signReleaseFile", () => {
  it("signs the claim over the file's SHA-256 so core verifies it", async () => {
    const file = path.join(appDir, "bundle.zip");
    fs.writeFileSync(file, "zip bytes");
    writeReleaseKey(appDir, pair.privateKey);
    const key = (await loadReleaseKey(appDir, {}))!;

    const signed = await signReleaseFile(
      {
        kind: "ota",
        appId: "com.example.app",
        platform: "android",
        version: "1.2.3",
        versionCode: 9,
        file,
      },
      key,
    );

    expect(signed.sha256).toBe(await sha256File(file));
    const claim = {
      kind: "ota" as const,
      appId: "com.example.app",
      platform: "android",
      version: "1.2.3",
      sha256: signed.sha256,
    };
    expect(await verifyRelease(claim, signed.signature, pair.publicKey)).toBe(true);
    expect(
      await verifyRelease({ ...claim, versionCode: 9 }, signed.signature, pair.publicKey),
    ).toBe(false);
  });

  it("binds a native signature to its build number", async () => {
    const file = path.join(appDir, "app.apk");
    fs.writeFileSync(file, "apk bytes");
    writeReleaseKey(appDir, pair.privateKey);
    const key = (await loadReleaseKey(appDir, {}))!;

    const signed = await signReleaseFile(
      {
        kind: "native",
        appId: "com.example.app",
        platform: "android",
        version: "2.0.0",
        versionCode: 14,
        file,
      },
      key,
    );

    const claim = {
      kind: "native" as const,
      appId: "com.example.app",
      platform: "android",
      version: "2.0.0",
      versionCode: 14,
      sha256: signed.sha256,
    };
    expect(await verifyRelease(claim, signed.signature, pair.publicKey)).toBe(true);
  });
});
