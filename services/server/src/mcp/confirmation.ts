import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** How long a preview's confirmation stays good. */
export const CONFIRMATION_TTL_MS = 5 * 60_000;

export interface ConfirmationSubject {
  userId: string;
  keyId: string | null;
  action: string;
  /** The arguments that decide what happens; the confirmation fields themselves are left out. */
  args: Record<string, unknown>;
}

const base64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

/** JSON with keys in a fixed order, so the same arguments always hash the same. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const digest = (subject: ConfirmationSubject) =>
  createHash("sha256")
    .update(
      `${subject.userId}\u0000${subject.keyId ?? ""}\u0000${subject.action}\u0000${canonical(subject.args)}`,
    )
    .digest("base64url");

const sign = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(`mcp-confirmation\u0000${payload}`).digest("base64url");

/**
 * A token that lets exactly this caller make exactly this change, for a few minutes. It is
 * stateless: replaying it repeats a change that has already happened, which every confirmed action
 * treats as a no-op.
 */
export function issueConfirmation(
  secret: string,
  subject: ConfirmationSubject,
  now: Date,
): { token: string; expires_at: string } {
  const expires = now.getTime() + CONFIRMATION_TTL_MS;
  const payload = base64url(JSON.stringify({ d: digest(subject), e: expires }));
  return {
    token: `${payload}.${sign(secret, payload)}`,
    expires_at: new Date(expires).toISOString(),
  };
}

export type ConfirmationCheck = "valid" | "expired" | "mismatch";

export function checkConfirmation(
  secret: string,
  token: string,
  subject: ConfirmationSubject,
  now: Date,
): ConfirmationCheck {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return "mismatch";
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "mismatch";
  let body: { d?: unknown; e?: unknown };
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return "mismatch";
  }
  if (typeof body.e !== "number" || typeof body.d !== "string") return "mismatch";
  if (body.d !== digest(subject)) return "mismatch";
  return now.getTime() > body.e ? "expired" : "valid";
}
