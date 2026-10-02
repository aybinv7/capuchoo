import { createPrivateKey, createSign, type KeyObject } from "node:crypto";

const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** Accepts a PEM pasted into an environment variable with its newlines escaped. */
export function parsePrivateKey(pem: string): KeyObject {
  const normalised = pem.includes("\\n") && !pem.includes("\n") ? pem.replace(/\\n/g, "\n") : pem;
  return createPrivateKey({ key: normalised.trim(), format: "pem" });
}

/**
 * The RS256 JWT a GitHub App authenticates as itself with. Backdated a minute for clock drift and
 * valid nine minutes, under GitHub's ten-minute ceiling.
 */
export function createAppJwt(appId: string, key: KeyObject, now: Date): string {
  const issued = Math.floor(now.getTime() / 1000) - 60;
  const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64(JSON.stringify({ iat: issued, exp: issued + 600, iss: appId }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(key).toString("base64url")}`;
}
