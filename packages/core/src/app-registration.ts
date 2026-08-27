/**
 * What happens when a bundle identifier is registered that already exists.
 *
 * `apps.app_id` is unique across the whole installation, so the second attempt
 * hits a constraint rather than a permission check - and the caller cannot see
 * the row that blocks them, because the listing is scoped to what they may
 * access. Left as a raw 23505 that becomes a 500, the state is unreachable:
 * the app cannot be created and cannot be seen.
 */

export interface ExistingApp {
  id: string;
  app_id: string;
  organization_id: string | null;
}

export interface AppRegistrationFacts {
  appId: string;
  /** The organisation the caller asked to register in. */
  requestedOrganizationId: string;
  /** The row already holding this bundle id, if any. */
  existing?: ExistingApp | null;
  /** Whether `existing.organization_id` still resolves to a real organisation. */
  existingOrganizationExists?: boolean;
  /** Whether the caller already holds a direct app_permissions grant on it. */
  callerHasDirectPermission?: boolean;
}

export type AdoptionReason = "same-organisation" | "direct-permission" | "orphaned";

export type AppRegistration =
  | { kind: "create" }
  | { kind: "adopt"; app: ExistingApp; reason: AdoptionReason }
  | { kind: "conflict"; app: ExistingApp };

/**
 * Whether to insert, return the existing row, or refuse.
 *
 * Adoption is what makes `capuchoo init` idempotent, which the model requires:
 * the identifier comes from the binary, so a second machine running init is
 * describing the same app rather than asking for a new one.
 */
export function decideAppRegistration(facts: AppRegistrationFacts): AppRegistration {
  const { existing, requestedOrganizationId } = facts;

  if (!existing) return { kind: "create" };

  if (existing.organization_id === requestedOrganizationId) {
    return { kind: "adopt", app: existing, reason: "same-organisation" };
  }

  if (facts.callerHasDirectPermission) {
    return { kind: "adopt", app: existing, reason: "direct-permission" };
  }

  // A row whose organisation no longer exists belongs to nobody, so claiming it
  // takes nothing from anyone. Without this the identifier is burned forever.
  if (existing.organization_id === null || facts.existingOrganizationExists === false) {
    return { kind: "adopt", app: existing, reason: "orphaned" };
  }

  return { kind: "conflict", app: existing };
}

/** Whether an adopted row should be moved into the requested organisation. */
export function adoptionReparents(reason: AdoptionReason): boolean {
  return reason === "orphaned";
}

export function describeAppConflict(appId: string): string {
  return (
    `${appId} is already registered to another organisation. Bundle identifiers are ` +
    "unique across Capuchoo, because a device reports only the id compiled into it. " +
    "Ask whoever owns it to release it, or change the applicationId."
  );
}

export function describeAdoption(reason: AdoptionReason, appId: string): string {
  switch (reason) {
    case "same-organisation":
      return `${appId} already exists in this organisation - linking to it.`;
    case "direct-permission":
      return `${appId} already exists and you have access to it - linking to it.`;
    case "orphaned":
      return `${appId} existed without an owning organisation - claiming it.`;
  }
}
