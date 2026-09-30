import { pemBody } from "@capuchoo/core";
import { describeChannel, isProtectedChannel, type ChannelClass } from "../deploy/channel-class.js";
import {
  PUBLIC_KEY_ENV,
  SIGNING_KEY_ENV,
  SIGNING_KEY_FILE,
  type ReleaseKey,
} from "./release-key.js";

export interface SigningPolicyFacts {
  channel: ChannelClass;
  key: ReleaseKey | null;
  /** Whether the server refuses unsigned uploads for this app; undefined when it did not say. */
  requireSignature: boolean | undefined;
  /** The public key the server holds, when it said. */
  serverPublicKey: string | null | undefined;
  /** `VITE_UPDATE_PUBLIC_KEY` from the flavour file, when set. */
  flavourPublicKey: string | undefined;
  flavourFile: string;
}

const NO_KEY = `Set ${SIGNING_KEY_ENV} (base64 PKCS#8) or create ${SIGNING_KEY_FILE} with capuchoo keys init.`;

function sameKey(a: string, b: string): boolean {
  return pemBody(a) === pemBody(b);
}

/**
 * Problems with release signing, found before anything is built. Pure over the facts.
 *
 * A mismatched key is refused on every channel: the server rejects the signature, and a build
 * baking a different public key rejects every bundle this key signs.
 */
export function describeSigningProblems(facts: SigningPolicyFacts): string[] {
  const { channel, key } = facts;

  if (!key) {
    if (facts.requireSignature) {
      const where = isProtectedChannel(channel)
        ? `${describeChannel(channel)} only accepts signed releases`
        : "This app requires signed releases";
      return [`${where}, and no signing key is available. ${NO_KEY}`];
    }
    if (facts.flavourPublicKey) {
      return [
        `${facts.flavourFile} sets ${PUBLIC_KEY_ENV}, so devices reject unsigned releases, and no signing key is available. ${NO_KEY}`,
      ];
    }
    return [];
  }

  const problems: string[] = [];

  if (facts.serverPublicKey && !sameKey(facts.serverPublicKey, key.publicKey)) {
    problems.push(
      `The signing key from ${key.source === "environment" ? SIGNING_KEY_ENV : SIGNING_KEY_FILE} (${key.fingerprint}) ` +
        "is not the one the server holds for this app. Use the matching key, or upload this one with capuchoo keys init.",
    );
  }

  if (facts.flavourPublicKey && !sameKey(facts.flavourPublicKey, key.publicKey)) {
    problems.push(
      `${facts.flavourFile} sets ${PUBLIC_KEY_ENV} to a different key than the one signing this release (${key.fingerprint}), ` +
        "so the built app would reject its own updates. Run capuchoo keys show for the right value.",
    );
  }

  return problems;
}
