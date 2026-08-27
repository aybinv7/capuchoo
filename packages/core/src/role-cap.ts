/** App roles, weakest first. Index is the ordering. */
export const APP_ROLE_ORDER = ["viewer", "tester", "developer", "admin"] as const;

export type AppRole = (typeof APP_ROLE_ORDER)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLE_ORDER as readonly string[]).includes(value);
}

/** How much a role can do, for comparison only. */
export function roleRank(role: AppRole): number {
  return APP_ROLE_ORDER.indexOf(role);
}

/**
 * The role a credential actually grants: the weaker of what the account has and
 * what the key is capped at.
 *
 * A key is the account acting through a machine, so it can never grant more than
 * the account has - and a cap lets it grant less, which is what makes a CI
 * credential safe to hand out. An uncapped key (null) is the account's own role.
 */
export function effectiveRole(
  accountRole: AppRole | null | undefined,
  keyCap?: AppRole | null,
): AppRole | null {
  if (!accountRole) return null;
  if (!keyCap) return accountRole;

  return roleRank(keyCap) < roleRank(accountRole) ? keyCap : accountRole;
}

/**
 * Whether a caller may mint a key capped at `requested`.
 *
 * A credential may never create one with more reach than itself, or a cap is not
 * a boundary - a developer key could mint an admin key and escalate. A caller
 * with no cap of its own (a dashboard session) may mint any.
 */
export function canIssueCap(
  callerCap: AppRole | null | undefined,
  requested: AppRole | null | undefined,
): boolean {
  if (!callerCap) return true;
  // An uncapped key is stronger than any capped one, so it cannot be issued by
  // a capped caller.
  if (!requested) return false;

  return roleRank(requested) <= roleRank(callerCap);
}

/** One line describing what a cap allows, for a key listing. */
export function describeCap(cap: AppRole | null | undefined): string {
  if (!cap) return "the account's own rights";

  return cap === "admin" || cap === "developer"
    ? `${cap} - may publish`
    : `${cap} - may not publish`;
}
