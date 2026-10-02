import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";
const INFO = "capuchoo/secret-box/v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypts third-party credentials at rest with AES-256-GCM under a key derived from `SECRET_KEY`.
 * The record is bound to its purpose through the additional data, so a ciphertext copied into
 * another column does not decrypt there.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(secretKey: string) {
    this.key = Buffer.from(hkdfSync("sha256", secretKey, "capuchoo", INFO, 32));
  }

  seal(plaintext: string, purpose: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(purpose));
    const body = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    return `${VERSION}.${iv.toString("base64url")}.${body.toString("base64url")}`;
  }

  /** Throws when the record was sealed under another key or purpose, or was altered. */
  open(record: string, purpose: string): string {
    const [version, iv, body] = record.split(".");
    if (version !== VERSION || !iv || !body) throw new Error("Not a sealed secret");
    const ivBytes = Buffer.from(iv, "base64url");
    const bytes = Buffer.from(body, "base64url");
    if (ivBytes.length !== IV_BYTES || bytes.length <= TAG_BYTES)
      throw new Error("Not a sealed secret");
    const decipher = createDecipheriv("aes-256-gcm", this.key, ivBytes);
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(bytes.subarray(bytes.length - TAG_BYTES));
    return Buffer.concat([
      decipher.update(bytes.subarray(0, bytes.length - TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
  }
}
