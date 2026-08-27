import type { Membership } from "../services/cloud.js";

/** The email on a membership row, or the raw user id when the join came back empty. */
export function emailOf(member: Membership): string {
  return member.users?.email ?? member.user_id;
}

export interface Resolution {
  ok: boolean;
  userId?: string;
  /** What to tell the caller when it failed. */
  problem?: string;
}

/**
 * Finds a member by email, case-insensitively.
 *
 * Resolved from a list the caller already has rather than by asking the server
 * to look an address up: there is no such endpoint, and adding one would be an
 * email enumeration surface.
 */
export function resolveByEmail(members: Membership[], email: string): Resolution {
  const wanted = email.trim().toLowerCase();

  if (!wanted) return { ok: false, problem: "An email is required." };

  const matches = members.filter((member) => emailOf(member).toLowerCase() === wanted);

  if (matches.length === 0) {
    const known = members.map(emailOf).sort();
    return {
      ok: false,
      problem:
        `No member with the email "${email}". ` +
        (known.length > 0 ? `Present: ${known.join(", ")}.` : "There are none yet."),
    };
  }

  // A duplicate would make the choice arbitrary, and removing the wrong person
  // is not recoverable from here.
  if (matches.length > 1) {
    return { ok: false, problem: `"${email}" matches ${matches.length} members. Resolve by hand.` };
  }

  return { ok: true, userId: matches[0]!.user_id };
}

/** Rows for a table, widest-email-first so the roles line up. */
export function membershipRows(members: Membership[]): Array<{ email: string; role: string }> {
  return members
    .map((member) => ({ email: emailOf(member), role: member.role }))
    .sort((a, b) => a.email.localeCompare(b.email));
}
