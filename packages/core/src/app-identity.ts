/**
 * Which application a bundle identifier belongs to, and which flavour of it.
 *
 * This replaces `environmentFromAppId`, which parsed `.dev` / `.staging` /
 * `.debug` off the end of a bundle id and treated the result as a safety gate.
 * That was a heuristic wearing a gate's clothes, and it failed in both
 * directions:
 *
 *   - `com.ayb.lowmaro` builds all three flavours from one identifier, so every
 *     build looked like production and its dev channel could never be served.
 *   - `com.acme.app.dev` was assumed to be a dev build by anyone who happened to
 *     end an identifier that way, whether or not they meant it.
 *
 * No other platform does this. Expo keys updates to an opaque project id and
 * lets the identifier vary per build profile; CodePush compiles a per-deployment
 * key into the binary; Capgo requires one app per identifier. All three take an
 * explicit token from the build rather than inferring one from its name.
 *
 * So the mapping is registered, not guessed. `flavour: null` is a real answer -
 * it means this identifier is shared by every flavour, and no flavour gate can
 * apply to it.
 */

import type { Environment } from "./update-contract.js";

export interface AppIdentity {
  /** The application's own id, which is not the bundle identifier. */
  appId: string;
  bundleId: string;
  /** null when every flavour ships under this identifier. */
  flavour: Environment | null;
}

export interface IdentityRow {
  app_id: string;
  bundle_id: string;
  platform?: string | null;
  flavour?: string | null;
}

/** The flavours an identifier may claim. Same values as Environment. */
export const APP_FLAVOURS = ["prod", "staging", "dev"] as const;

export type AppFlavour = (typeof APP_FLAVOURS)[number];

export function isFlavour(value: unknown): value is Environment {
  return typeof value === "string" && (APP_FLAVOURS as readonly string[]).includes(value);
}

/** A stored row as the decision layer wants it. Anything unrecognised is null. */
export function toAppIdentity(row: IdentityRow): AppIdentity {
  return {
    appId: row.app_id,
    bundleId: row.bundle_id,
    flavour: isFlavour(row.flavour) ? row.flavour : null,
  };
}

/**
 * Whether a build of `buildFlavour` may be served a channel bound to
 * `channelFlavour`.
 *
 * `null` means the identifier makes no claim, so there is nothing to contradict
 * and the channel decides alone. This is the case that the old heuristic could
 * not express, and it is the common one: a single identifier with per-flavour
 * env files is the default Capacitor setup.
 *
 * When a claim exists it is exact. The old rule let a prod build onto a staging
 * channel, which existed only to make suffix-less identifiers usable at all -
 * with a real claim, a prod build on a staging channel is either deliberate (and
 * the identifier should say `null`) or a mistake worth refusing.
 */
export function isFlavourAllowed(
  buildFlavour: Environment | null,
  channelFlavour: Environment | null | undefined,
): boolean {
  if (buildFlavour === null) return true;
  if (!channelFlavour) return true;

  return buildFlavour === channelFlavour;
}

export function describeFlavourMismatch(
  bundleId: string,
  buildFlavour: Environment,
  channelFlavour: Environment,
  channelName: string,
): string {
  return (
    `Channel "${channelName}" serves ${channelFlavour} builds, but ${bundleId} is ` +
    `registered as the ${buildFlavour} identifier for this app. Register it as a ` +
    "shared identifier if every flavour ships under it, or deploy to the channel " +
    `bound to ${buildFlavour}.`
  );
}

/**
 * Why an upload was refused.
 *
 * Checked before the artefact reaches storage. The channel pointer is only
 * resolved after the upload in the existing flow, so a mismatch discovered
 * there would have already spent the bandwidth and left an orphan object.
 */
export function describeUploadFlavourMismatch(
  channelName: string,
  channelFlavour: Environment,
  declared: Environment,
): string {
  return (
    `Channel "${channelName}" serves ${channelFlavour} builds, and this artefact was ` +
    `built from the ${declared} flavour. Every bundle on a channel has to come from ` +
    "one flavour, or a device gets a bundle its binary was not built for. Deploy to " +
    `the ${declared} channel, or rebind this one.`
  );
}
