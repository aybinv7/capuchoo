import { hkdfSync } from "node:crypto";
import { hmacHex, safeEqual } from "./crypto";

/**
 * A tamper-proof, expiring value for an OAuth-style round trip through a third party. Nothing is
 * stored: the signature binds the payload to this server and to its purpose.
 */
export class SignedState {
  private readonly key: string;

  constructor(secretKey: string) {
    this.key = Buffer.from(
      hkdfSync("sha256", secretKey, "capuchoo", "capuchoo/signed-state/v1", 32),
    ).toString("hex");
  }

  sign(purpose: string, payload: Record<string, unknown>, expiresAt: Date): string {
    const body = Buffer.from(
      JSON.stringify({ ...payload, p: purpose, e: expiresAt.getTime() }),
    ).toString("base64url");
    return `${body}.${hmacHex(this.key, body)}`;
  }

  /** The payload, or null when it was altered, expired, or signed for another purpose. */
  verify<T extends Record<string, unknown>>(
    purpose: string,
    state: string | undefined,
    now: Date,
  ): T | null {
    if (!state || state.length > 4096) return null;
    const [body, signature] = state.split(".");
    if (!body || !signature || !safeEqual(signature, hmacHex(this.key, body))) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
        string,
        unknown
      >;
      if (payload.p !== purpose || typeof payload.e !== "number" || payload.e < now.getTime())
        return null;
      return payload as T;
    } catch {
      return null;
    }
  }
}
