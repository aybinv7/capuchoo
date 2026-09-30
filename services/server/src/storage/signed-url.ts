import { hmacHex, safeEqual } from "../lib/crypto";

/** A time-limited download path for an artefact; the signature binds key and expiry. */
export function signArtefactPath(secret: string, key: string, expiresAt: number): string {
  const exp = Math.floor(expiresAt / 1000);
  const sig = hmacHex(secret, `artefact\n${key}\n${exp}`);
  return `/api/artefacts/${key}?exp=${exp}&sig=${sig}`;
}

export type SignatureCheck = "ok" | "expired" | "invalid";

export function verifyArtefactSignature(
  secret: string,
  key: string,
  exp: string | undefined,
  sig: string | undefined,
  now: number,
): SignatureCheck {
  if (!exp || !sig || !/^\d+$/.test(exp)) return "invalid";
  if (!safeEqual(hmacHex(secret, `artefact\n${key}\n${exp}`), sig)) return "invalid";
  return Number(exp) * 1000 < now ? "expired" : "ok";
}
