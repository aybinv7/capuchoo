/**
 * A channel's `environment` decides which `.env` flavour the CLI builds and which
 * bundles the backend serves to it. The channel's *name* is only an identifier.
 *
 * Nothing links the two, so a channel named `prod` left on the `staging`
 * environment silently serves staging bundles to production devices - which is
 * how all three of Lowmaro's channels ended up on staging. These helpers make
 * the mismatch visible; they never correct it silently, because prod apps
 * legitimately point at a staging channel for beta testing.
 */

export type ChannelEnvironment = "prod" | "staging" | "dev";

/** Empty means "not chosen yet". A channel must not default into an environment. */
export type ChannelEnvironmentSelection = ChannelEnvironment | "";

const PATTERNS: Array<[ChannelEnvironment, RegExp]> = [
  ["prod", /^(prod|production|live|release|stable|main|master)$/],
  ["staging", /^(staging|stage|beta|uat|qa|test|preprod|pre-prod)$/],
  ["dev", /^(dev|develop|development|debug|local|alpha)$/],
];

/**
 * The environment a channel name implies, or `null` when the name says nothing.
 *
 * Matching is deliberately whole-name: a channel called `prod-eu` could belong
 * to either, and guessing at substrings would put a warning on names it cannot
 * reason about.
 */
export function suggestEnvironment(name: string): ChannelEnvironment | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  for (const [environment, pattern] of PATTERNS) {
    if (pattern.test(normalized)) return environment;
  }

  return null;
}

/** True when the name implies one environment and a different one is selected. */
export function hasEnvironmentMismatch(
  name: string,
  environment: ChannelEnvironmentSelection,
): boolean {
  if (!environment) return false;

  const suggested = suggestEnvironment(name);
  return suggested !== null && suggested !== environment;
}

/** The warning to show for a mismatch, or `null` when there is nothing to warn about. */
export function environmentMismatchWarning(
  name: string,
  environment: ChannelEnvironmentSelection,
): string | null {
  if (!hasEnvironmentMismatch(name, environment)) return null;

  const label = name.trim();
  return (
    `A channel named "${label}" is set to the ${environment} environment. ` +
    `Devices on it will receive ${environment} bundles, built from .env.${environment}. ` +
    `Set the environment to ${suggestEnvironment(label)} unless that is deliberate.`
  );
}
