import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** A secret one side presents once to join a session; only its hash is kept. */
export interface Ticket {
  plain: string;
  hash: Buffer;
}

export function newTicket(): Ticket {
  const plain = randomBytes(32).toString("base64url");
  return { plain, hash: hashTicket(plain) };
}

export const hashTicket = (plain: string): Buffer => createHash("sha256").update(plain).digest();

export function ticketMatches(plain: string, hash: Buffer): boolean {
  if (plain.length === 0 || plain.length > 128) return false;
  return timingSafeEqual(hashTicket(plain), hash);
}
