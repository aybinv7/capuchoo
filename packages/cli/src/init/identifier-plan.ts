import { ENVIRONMENTS, type Environment } from "@capuchoo/core";

export interface IdentifierPlan {
  bundleId: string;
  /** Null: every flavour ships under it. */
  flavour: Environment | null;
}

export type FlavourIds = "shared" | "suffixed";

export const FLAVOUR_ID_MODES: readonly FlavourIds[] = ["shared", "suffixed"];

/**
 * The bundle id a flavour builds under. Suffixed ids let dev and staging install beside prod on
 * one phone; prod keeps the base id so a release still updates the installed app.
 */
export function flavourAppId(base: string, environment: Environment, mode: FlavourIds): string {
  if (mode === "shared" || environment === "prod") return base;
  return `${base}.${environment}`;
}

/**
 * One identifier per distinct id the flavours declare. An id built by exactly one flavour claims
 * it; an id several flavours share claims none, which is what a single-identifier app is.
 */
export function planFlavourIdentifiers(
  declared: Partial<Record<Environment, string>>,
  fallback: string,
): IdentifierPlan[] {
  const owners = new Map<string, Environment[]>();

  for (const environment of ENVIRONMENTS) {
    const bundleId = declared[environment]?.trim() || fallback;
    owners.set(bundleId, [...(owners.get(bundleId) ?? []), environment]);
  }

  if (owners.size === 1) return [{ bundleId: [...owners.keys()][0] ?? fallback, flavour: null }];

  return [...owners].map(([bundleId, environments]) => ({
    bundleId,
    flavour: environments.length === 1 ? (environments[0] ?? null) : null,
  }));
}

export interface IdentifierRowLike {
  bundle_id: string;
  flavour?: string | null | undefined;
}

export interface IdentifierDiff {
  missing: IdentifierPlan[];
  /** Registered for another flavour than the env files now build; there is no edit, only remove and add. */
  conflicting: Array<{ plan: IdentifierPlan; registered: string }>;
}

export function diffIdentifiers(
  plans: IdentifierPlan[],
  existing: readonly IdentifierRowLike[],
): IdentifierDiff {
  const byId = new Map(existing.map((row) => [row.bundle_id, row]));
  const diff: IdentifierDiff = { missing: [], conflicting: [] };

  for (const plan of plans) {
    const row = byId.get(plan.bundleId);
    if (!row) diff.missing.push(plan);
    else if (row.flavour && row.flavour !== plan.flavour)
      diff.conflicting.push({ plan, registered: row.flavour });
  }

  return diff;
}
