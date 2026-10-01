import {
  isStorageId,
  opfsSahPool,
  STORAGE_IDS,
  type StorageCandidate,
} from "@/shared/database/candidates";

/**
 * The knob. Walked in order, first candidate that opens wins, and the rest are never imported - so a
 * chain that stops at the first entry never downloads the others' wasm.
 *
 * Reorder freely to trade speed for reach: the entries lower down reach older WebViews, and each
 * one states its own `tradeoff` and whether its `evidence` came from a device or a vendor's README.
 * Read the list rather than this comment - `@cavulsqa/create` removes the engines an app did not
 * ask for, so what is below is what this app actually has.
 *
 * No in-memory entry on purpose: a chain that ends somewhere data is not kept is worse than one that
 * fails and names every attempt.
 */
export const DEFAULT_ORDER: StorageCandidate[] = [
  opfsSahPool,
];

/**
 * `VITE_STORAGE_ENGINE` promotes one candidate to the front and leaves the rest as fallback, so the
 * env var reorders the chain rather than replacing it - a device that cannot open the preferred
 * engine still gets a working app.
 *
 * A typo is reported and ignored rather than fatal: it should not brick the build's output, but a
 * setting that was silently dropped looks exactly like one that was applied and did nothing.
 */
/**
 * What `VITE_STORAGE_ENGINE` was at build time, or undefined.
 *
 * Exported so the open can report it. Vite inlines this when it bundles, so an empty value means
 * the variable never reached the build - a `.env` written as UTF-16 by PowerShell's `>` parses as
 * garbage and is dropped without a word.
 */
export const preferredEngine = import.meta.env.VITE_STORAGE_ENGINE;

function preferredFirst(candidates: StorageCandidate[]): StorageCandidate[] {
  const preferred = preferredEngine;
  if (!preferred) return candidates;

  if (!isStorageId(preferred)) {
    console.warn(
      `[storage] VITE_STORAGE_ENGINE="${preferred}" is not an engine this app has. ` +
        `Expected one of: ${STORAGE_IDS.join(", ")}. Falling back to the default order.`,
    );
    return candidates;
  }

  const match = candidates.find((candidate) => candidate.id === preferred);
  return match ? [match, ...candidates.filter((candidate) => candidate !== match)] : candidates;
}

export const storageChain: StorageCandidate[] = preferredFirst(DEFAULT_ORDER);
