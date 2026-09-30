/**
 * Release signatures: ECDSA P-256 over SHA-256, through WebCrypto so the CLI, the server and the
 * WebView share one implementation.
 */

export type ReleaseKind = "ota" | "native";

export interface ReleaseClaim {
  kind: ReleaseKind;
  /** The app's primary bundle identifier. */
  appId: string;
  platform: string;
  version: string;
  /** Native build number; absent for an OTA bundle. */
  versionCode?: number | null | undefined;
  /** Lowercase hex SHA-256 of the artefact. */
  sha256: string;
}

const SIGNATURE_VERSION = "capuchoo-release-v1";
const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_PARAMS = { name: "ECDSA", hash: "SHA-256" } as const;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** The exact bytes that are signed. Newline-separated so no field can shift into another. */
export function releaseSignaturePayload(claim: ReleaseClaim): string {
  for (const [field, value] of [
    ["appId", claim.appId],
    ["platform", claim.platform],
    ["version", claim.version],
  ] as const) {
    if (!value || value.includes("\n")) throw new Error(`Release ${field} is empty or multi-line`);
  }
  if (!SHA256_HEX.test(claim.sha256)) throw new Error("Release sha256 must be 64 lowercase hex");

  return [
    SIGNATURE_VERSION,
    claim.kind,
    claim.appId,
    claim.platform,
    claim.version,
    claim.versionCode === null || claim.versionCode === undefined ? "" : String(claim.versionCode),
    claim.sha256,
  ].join("\n");
}

type Subtle = NonNullable<typeof globalThis.crypto>["subtle"];

function subtle(): Subtle {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new Error("WebCrypto is not available in this runtime");
  return api;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Strips PEM armour, so either a bare base64 body or a PEM file is accepted. */
export function pemBody(value: string): string {
  return value
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
}

/** A new signing key pair: base64 PKCS#8 private key, base64 SPKI public key. */
export async function generateReleaseKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
  const pair = await subtle().generateKey(ALGORITHM, true, ["sign", "verify"]);
  const [privateKey, publicKey] = await Promise.all([
    subtle().exportKey("pkcs8", pair.privateKey),
    subtle().exportKey("spki", pair.publicKey),
  ]);
  return {
    privateKey: toBase64(new Uint8Array(privateKey)),
    publicKey: toBase64(new Uint8Array(publicKey)),
  };
}

/** Signs a claim with a base64 (or PEM) PKCS#8 private key; returns base64url P1363. */
export async function signRelease(claim: ReleaseClaim, privateKey: string): Promise<string> {
  const key = await subtle().importKey("pkcs8", fromBase64(pemBody(privateKey)), ALGORITHM, false, [
    "sign",
  ]);
  const signature = await subtle().sign(
    SIGN_PARAMS,
    key,
    new TextEncoder().encode(releaseSignaturePayload(claim)),
  );
  return toBase64Url(new Uint8Array(signature));
}

/** The public key matching a private key, as base64 SPKI. */
export async function publicKeyFor(privateKey: string): Promise<string> {
  const key = await subtle().importKey("pkcs8", fromBase64(pemBody(privateKey)), ALGORITHM, true, [
    "sign",
  ]);
  const jwk = await subtle().exportKey("jwk", key);
  const { d: _discard, ...publicJwk } = jwk;
  const publicKey = await subtle().importKey(
    "jwk",
    { ...publicJwk, key_ops: ["verify"] },
    ALGORITHM,
    true,
    ["verify"],
  );
  return toBase64(new Uint8Array(await subtle().exportKey("spki", publicKey)));
}

/** True only for a well-formed signature by the given base64 (or PEM) SPKI public key. */
export async function verifyRelease(
  claim: ReleaseClaim,
  signature: string | null | undefined,
  publicKey: string,
): Promise<boolean> {
  if (!signature) return false;
  try {
    const key = await subtle().importKey("spki", fromBase64(pemBody(publicKey)), ALGORITHM, false, [
      "verify",
    ]);
    return await subtle().verify(
      SIGN_PARAMS,
      key,
      fromBase64(signature),
      new TextEncoder().encode(releaseSignaturePayload(claim)),
    );
  } catch {
    return false;
  }
}

/** Short, stable fingerprint of a public key for display: first 16 hex chars of its SHA-256. */
export async function publicKeyFingerprint(publicKey: string): Promise<string> {
  const digest = await subtle().digest("SHA-256", fromBase64(pemBody(publicKey)));
  return Array.from(new Uint8Array(digest).slice(0, 8), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
