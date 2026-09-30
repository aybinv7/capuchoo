import { pemBody, publicKeyFingerprint, publicKeyFor } from "@capuchoo/core";
import fs from "node:fs";
import path from "node:path";
import { writePrivateFile } from "../utils/secure-file.js";

/** Relative to the app; must never be committed. */
export const SIGNING_KEY_FILE = ".capuchoo/signing-key.pem";

export const SIGNING_KEY_ENV = "CAPUCHOO_SIGNING_KEY";

/** The flavour env key the updater reads to verify releases. */
export const PUBLIC_KEY_ENV = "VITE_UPDATE_PUBLIC_KEY";

export interface ReleaseKey {
  /** Base64 PKCS#8. */
  privateKey: string;
  /** Base64 SPKI. */
  publicKey: string;
  fingerprint: string;
  source: "environment" | "file";
  /** Absolute path when read from the file. */
  file?: string;
}

export function signingKeyPath(appDir: string): string {
  return path.join(appDir, SIGNING_KEY_FILE);
}

/** PKCS#8 PEM armour around a base64 body, wrapped at 64 columns. */
export function toPrivateKeyPem(privateKey: string): string {
  const lines = pemBody(privateKey).match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

async function describeKey(
  privateKey: string,
  source: ReleaseKey["source"],
  origin: string,
  file?: string,
): Promise<ReleaseKey> {
  let publicKey: string;
  try {
    publicKey = await publicKeyFor(privateKey);
  } catch {
    throw new Error(`${origin} is not a P-256 PKCS#8 private key. Run capuchoo keys init.`);
  }
  return {
    privateKey: pemBody(privateKey),
    publicKey,
    fingerprint: await publicKeyFingerprint(publicKey),
    source,
    ...(file ? { file } : {}),
  };
}

/**
 * The release signing key: `CAPUCHOO_SIGNING_KEY` (base64 PKCS#8 or PEM) wins over the
 * git-ignored pem file. Null when neither exists; throws when one exists but is unusable.
 */
export async function loadReleaseKey(
  appDir: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReleaseKey | null> {
  const fromEnv = env[SIGNING_KEY_ENV]?.trim();
  if (fromEnv) return describeKey(fromEnv, "environment", SIGNING_KEY_ENV);

  const file = signingKeyPath(appDir);
  if (!fs.existsSync(file)) return null;
  return describeKey(fs.readFileSync(file, "utf8"), "file", SIGNING_KEY_FILE, file);
}

/** Writes the private key owner-only and atomically. */
export function writeReleaseKey(appDir: string, privateKey: string): string {
  const file = signingKeyPath(appDir);
  writePrivateFile(file, toPrivateKeyPem(privateKey));
  return file;
}
