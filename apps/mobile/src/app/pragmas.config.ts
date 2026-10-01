/**
 * PRAGMAs applied to every engine identically, because SQLite's defaults are per-build and two
 * engines left on their own are not comparable - an unpinned `synchronous` alone produced a 1.47x
 * "ranking" between engines that were the same speed.
 *
 * `fast` is for measuring only: `synchronous = OFF` hands durability to the OS, so a battery pull can
 * leave the database corrupt rather than merely stale. `safe` costs 19-57 ms on a single write and
 * under 3 ms per row inside a transaction, so an app that batches gives up very little.
 */
export type PragmaProfile = "fast" | "safe";

const PROFILES: Record<PragmaProfile, readonly string[]> = {
  fast: [
    // No journal file to create, write and delete per transaction.
    "PRAGMA journal_mode = MEMORY",
    // The big one for single writes, and the one that trades away crash durability.
    "PRAGMA synchronous = OFF",
    "PRAGMA temp_store = MEMORY",
    // Negative means KiB rather than pages: 16 MB of page cache.
    "PRAGMA cache_size = -16000",
  ],
  safe: [
    "PRAGMA journal_mode = TRUNCATE",
    "PRAGMA synchronous = FULL",
    "PRAGMA temp_store = MEMORY",
    "PRAGMA cache_size = -16000",
  ],
};

export const pragmaProfile: PragmaProfile =
  import.meta.env.VITE_PRAGMA_PROFILE === "fast" ? "fast" : "safe";

export function pragmasFor(profile: PragmaProfile): readonly string[] {
  return PROFILES[profile];
}
