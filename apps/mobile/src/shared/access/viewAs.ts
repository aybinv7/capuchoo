import { effectiveRole, isAppRole, type AppRole } from "@capuchoo/core";

const KEY = "capuchoo.viewAs";

/**
 * A role to see the app as, for trying what a tester or a viewer gets. It only ever lowers what
 * this phone offers - `effectiveRole` takes the weaker of the two, as an API key's cap does - and
 * the server keeps deciding on the account's real role, so a preview cannot grant anything.
 */
const stored = useLocalStorage<string | null>(KEY, null, { writeDefaults: false });

export const viewAs = computed<AppRole | null>(() =>
  isAppRole(stored.value) ? stored.value : null,
);

export function setViewAs(role: AppRole | null): void {
  stored.value = role;
}

/** The role this phone acts on: the account's own, or the preview when it is lower. */
export function viewedRole(actual: AppRole): AppRole {
  return effectiveRole(actual, viewAs.value) ?? actual;
}

export function isPreviewing(actual: AppRole): boolean {
  return viewedRole(actual) !== actual;
}
