import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  androidSdkRoot,
  findApksigner,
  normaliseDigest,
  parseApksignerOutput,
  parseKeytoolOutput,
} from "./apk-certificate.js";

const DIGEST = "3f2a1b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708";

const APKSIGNER = `Signer #1 certificate DN: CN=Android Debug, O=Android, C=US
Signer #1 certificate SHA-256 digest: ${DIGEST}
Signer #1 certificate SHA-1 digest: 0123456789abcdef0123456789abcdef01234567
Signer #1 certificate MD5 digest: 0123456789abcdef0123456789abcdef
Signer #2 certificate SHA-256 digest: ${"f".repeat(64)}
`;

const KEYTOOL = `Signer #1:

Signature:

Owner: CN=Upload, OU=Mobile, O=Example, C=DZ
Issuer: CN=Upload, OU=Mobile, O=Example, C=DZ
Certificate fingerprints:
\t SHA1: 01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67
\t SHA256: ${DIGEST.toUpperCase().match(/.{2}/g)!.join(":")}
Signature algorithm name: SHA256withRSA
`;

describe("certificate parsers", () => {
  it("reads the first signer from apksigner", () => {
    expect(parseApksignerOutput(APKSIGNER)).toBe(DIGEST);
  });

  it("reads the colon-separated SHA256 line from keytool", () => {
    expect(parseKeytoolOutput(KEYTOOL)).toBe(DIGEST);
  });

  it("returns null for an unsigned jar", () => {
    expect(parseKeytoolOutput("Not a signed jar file")).toBeNull();
    expect(parseApksignerOutput("DOES NOT VERIFY")).toBeNull();
  });

  it("normalises and validates digests", () => {
    expect(normaliseDigest("AB:".repeat(31) + "AB")).toBe("ab".repeat(32));
    expect(normaliseDigest("abc")).toBeNull();
  });
});

describe("tool discovery", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-sdk-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("picks apksigner from the newest build-tools", () => {
    const name = process.platform === "win32" ? "apksigner.bat" : "apksigner";
    for (const version of ["30.0.3", "35.0.0", "34.0.0-rc1"]) {
      fs.mkdirSync(path.join(dir, "build-tools", version), { recursive: true });
      fs.writeFileSync(path.join(dir, "build-tools", version, name), "");
    }
    expect(findApksigner(dir)).toBe(path.join(dir, "build-tools", "35.0.0", name));
  });

  it("has no apksigner without an SDK", () => {
    expect(findApksigner(null)).toBeNull();
    expect(findApksigner(dir)).toBeNull();
  });

  it("reads sdk.dir from local.properties when no variable is set", () => {
    const sdk = path.join(dir, "sdk");
    fs.mkdirSync(sdk);
    const escaped = sdk.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
    fs.writeFileSync(path.join(dir, "local.properties"), `sdk.dir=${escaped}\n`);
    expect(androidSdkRoot(dir, {})).toBe(sdk);
  });

  it("prefers ANDROID_HOME", () => {
    expect(androidSdkRoot(dir, { ANDROID_HOME: dir })).toBe(dir);
  });
});
