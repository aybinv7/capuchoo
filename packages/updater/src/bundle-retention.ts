/**
 * Which stored OTA bundles to keep, reuse, or delete.
 *
 * Pure over the plugin's `list()` output; `storage.service.ts` supplies the
 * plugin. See docs/CAPGO-PLUGIN.md, "Storage", for why the plugin's own
 * `autoDeletePrevious` does not cover this.
 */

export type StoredBundleStatus =
  | "success"
  | "error"
  | "pending"
  | "downloading"
  | "deleted"
  | "deleting";

export interface StoredBundle {
  id: string;
  version: string;
  downloaded: string;
  checksum: string;
  status: StoredBundleStatus | (string & {});
}

/** The OTA update the app may still apply: its version, and the bundle already bound to it. */
export interface BundleOffer {
  version: string;
  bundleId?: string | undefined;
  checksum?: string | undefined;
}

const BUILTIN_IDS = new Set(["builtin", "unknown"]);
const DOWNLOADED = new Set(["pending", "success"]);
const DISPOSABLE = new Set(["pending", "success", "error"]);

function sameChecksum(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

function downloadedAt(bundle: StoredBundle): number {
  const time = Date.parse(bundle.downloaded);
  return Number.isNaN(time) ? 0 : time;
}

/**
 * A downloaded bundle that is exactly this update, so applying it needs no
 * second download.
 *
 * The plugin's JavaScript `download()` never looks for one - unlike its own
 * background check - so every apply after a background download stored the
 * same version twice. A checksum is required: without one nothing ties the
 * stored bytes to the release the app verified.
 */
export function reusableBundle(
  bundles: readonly StoredBundle[],
  update: { version: string; checksum?: string | undefined },
): StoredBundle | null {
  const matches = bundles.filter(
    (bundle) =>
      DOWNLOADED.has(bundle.status) &&
      bundle.version === update.version &&
      sameChecksum(bundle.checksum, update.checksum),
  );
  return newest(matches);
}

function newest(bundles: readonly StoredBundle[]): StoredBundle | null {
  let best: StoredBundle | null = null;
  for (const bundle of bundles) {
    if (
      !best ||
      downloadedAt(bundle) > downloadedAt(best) ||
      (downloadedAt(bundle) === downloadedAt(best) && bundle.id > best.id)
    ) {
      best = bundle;
    }
  }
  return best;
}

function isOfferCandidate(bundle: StoredBundle, offer: BundleOffer): boolean {
  if (!DOWNLOADED.has(bundle.status) || bundle.version !== offer.version) return false;
  if (bundle.id === offer.bundleId) return true;
  return !offer.checksum || sameChecksum(bundle.checksum, offer.checksum);
}

/** The one stored bundle worth keeping for the update on offer, or null. */
function offerBundle(
  bundles: readonly StoredBundle[],
  offer: BundleOffer | null,
  protectedIds: ReadonlySet<string>,
): StoredBundle | null {
  if (!offer) return null;
  const candidates = bundles.filter((bundle) => isOfferCandidate(bundle, offer));
  if (candidates.some((bundle) => protectedIds.has(bundle.id))) return null;
  return candidates.find((bundle) => bundle.id === offer.bundleId) ?? newest(candidates);
}

/**
 * The ids to delete once the running bundle is confirmed.
 *
 * Kept: the running bundle, the builtin, the plugin's next bundle, anything the
 * plugin is still downloading or already deleting, and one downloaded copy of
 * the update on offer - the bound one, else the newest. Rollback needs nothing
 * more: a confirmed bundle becomes the plugin's fallback, so after
 * `notifyAppReady` the fallback is the running bundle.
 *
 * Everything else that is downloaded or failed goes, including a second copy
 * of the running version and bundles for versions the server has moved past.
 */
export function bundlesToDelete(input: {
  bundles: readonly StoredBundle[];
  currentId: string;
  nextId?: string | null | undefined;
  offer: BundleOffer | null;
}): string[] {
  const { bundles, currentId, nextId, offer } = input;
  const keep = new Set<string>([currentId, ...BUILTIN_IDS]);
  if (nextId) keep.add(nextId);

  const offered = offerBundle(bundles, offer, keep);
  if (offered) keep.add(offered.id);

  return bundles
    .filter((bundle) => !keep.has(bundle.id) && DISPOSABLE.has(bundle.status))
    .map((bundle) => bundle.id);
}

/** How long a `downloading` entry counts as live; a killed process leaves the status behind for good. */
export const DOWNLOAD_STALE_MS = 60 * 60_000;

/** Whether the plugin is writing a bundle right now. */
export function isDownloading(bundles: readonly StoredBundle[], now: number = Date.now()): boolean {
  return bundles.some((bundle) => {
    if (bundle.status !== "downloading") return false;
    const startedAt = Date.parse(bundle.downloaded);
    return Number.isNaN(startedAt) || now - startedAt < DOWNLOAD_STALE_MS;
  });
}
