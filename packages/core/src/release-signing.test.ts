import { describe, expect, it } from "vite-plus/test";
import {
  generateReleaseKeyPair,
  publicKeyFingerprint,
  publicKeyFor,
  releaseSignaturePayload,
  signRelease,
  verifyRelease,
  type ReleaseClaim,
} from "./release-signing.js";

const claim: ReleaseClaim = {
  kind: "ota",
  appId: "com.presalio.retail.app",
  platform: "android",
  version: "1.6.0",
  sha256: "a".repeat(64),
};

describe("releaseSignaturePayload", () => {
  it("is stable and versioned", () => {
    expect(releaseSignaturePayload(claim)).toBe(
      `capuchoo-release-v1\nota\ncom.presalio.retail.app\nandroid\n1.6.0\n\n${"a".repeat(64)}`,
    );
  });

  it("carries the build number for a native release", () => {
    expect(releaseSignaturePayload({ ...claim, kind: "native", versionCode: 42 })).toContain(
      "\n1.6.0\n42\n",
    );
  });

  it.each([
    ["a multi-line version", { version: "1.0\n0" }],
    ["an empty app id", { appId: "" }],
    ["an uppercase checksum", { sha256: "A".repeat(64) }],
    ["a short checksum", { sha256: "ab" }],
  ])("refuses %s", (_label, patch) => {
    expect(() => releaseSignaturePayload({ ...claim, ...patch })).toThrow();
  });
});

describe("signRelease / verifyRelease", () => {
  it("round-trips", async () => {
    const { privateKey, publicKey } = await generateReleaseKeyPair();
    const signature = await signRelease(claim, privateKey);

    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
    await expect(verifyRelease(claim, signature, publicKey)).resolves.toBe(true);
  });

  it("rejects any changed field", async () => {
    const { privateKey, publicKey } = await generateReleaseKeyPair();
    const signature = await signRelease(claim, privateKey);

    for (const patch of [
      { version: "1.6.1" },
      { sha256: "b".repeat(64) },
      { platform: "ios" },
      { appId: "com.other" },
      { kind: "native" as const },
    ]) {
      await expect(verifyRelease({ ...claim, ...patch }, signature, publicKey)).resolves.toBe(
        false,
      );
    }
  });

  it("rejects another key, a missing and a garbage signature", async () => {
    const signer = await generateReleaseKeyPair();
    const other = await generateReleaseKeyPair();
    const signature = await signRelease(claim, signer.privateKey);

    await expect(verifyRelease(claim, signature, other.publicKey)).resolves.toBe(false);
    await expect(verifyRelease(claim, null, signer.publicKey)).resolves.toBe(false);
    await expect(verifyRelease(claim, "not-a-signature", signer.publicKey)).resolves.toBe(false);
    await expect(verifyRelease(claim, signature, "garbage")).resolves.toBe(false);
  });

  it("accepts PEM armour around either key", async () => {
    const { privateKey, publicKey } = await generateReleaseKeyPair();
    const pem = (label: string, body: string) =>
      `-----BEGIN ${label}-----\n${body.match(/.{1,64}/g)!.join("\n")}\n-----END ${label}-----\n`;
    const signature = await signRelease(claim, pem("PRIVATE KEY", privateKey));

    await expect(verifyRelease(claim, signature, pem("PUBLIC KEY", publicKey))).resolves.toBe(true);
  });

  it("derives the public key and a stable fingerprint", async () => {
    const { privateKey, publicKey } = await generateReleaseKeyPair();

    await expect(publicKeyFor(privateKey)).resolves.toBe(publicKey);
    const fingerprint = await publicKeyFingerprint(publicKey);
    expect(fingerprint).toMatch(/^[0-9a-f]{16}$/);
    await expect(publicKeyFingerprint(publicKey)).resolves.toBe(fingerprint);
  });
});
