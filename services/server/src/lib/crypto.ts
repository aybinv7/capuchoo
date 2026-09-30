import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

interface ScryptParams {
  N: number;
  r: number;
  p: number;
  keylen: number;
}

const SCRYPT: ScryptParams = { N: 16384, r: 8, p: 5, keylen: 64 };
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      params.keylen,
      { N: params.N, r: params.r, p: params.p, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

/** `scrypt$N$r$p$salt$hash`, so parameters can be raised later without breaking stored hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, SCRYPT);
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/** Constant work whether or not the account exists, so timing does not reveal it. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    await hashPassword(password);
    return false;
  }
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    keylen: expected.length,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A random, URL-safe secret with a recognisable prefix. */
export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Constant-time comparison of two strings of possibly different length. */
export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
