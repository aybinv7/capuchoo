/**
 * The plugin's per-file delta cache, `<cache>/capgo_downloads`.
 *
 * After every zip download the plugin copies each file that differs from the
 * builtin into it as `<sha256>_<name>`, so a later manifest (delta) download
 * can reuse them. Capuchoo serves whole zips and never sends a `manifest`, so
 * nothing ever reads these copies; the plugin only clears the folder when the
 * native version changes. One OTA a day therefore grows it by a bundle a day.
 */

export const DELTA_CACHE_DIRECTORY = "capgo_downloads";

const CACHE_ENTRY = /^[0-9a-f]{64}_./;

/**
 * The entries to delete, given the file hashes the current manifest still
 * needs - none, while updates ship as whole zips.
 *
 * Only `<sha256>_<name>` entries are touched: partial downloads and temp files
 * in the same folder belong to a download the plugin may still be running.
 */
export function deltaCacheEntriesToDelete(
  names: readonly string[],
  keepHashes: ReadonlySet<string> = new Set(),
): string[] {
  return names.filter((name) => CACHE_ENTRY.test(name) && !keepHashes.has(name.slice(0, 64)));
}
