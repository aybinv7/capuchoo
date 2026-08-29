/**
 * Handing out a download link that expires, instead of a permanent public one.
 *
 * Every bundle and APK is stored in a public Supabase bucket, so its URL is
 * fetchable by anyone who has it - and `POST /api/update` hands those URLs to
 * unauthenticated callers by design, because the device asking has no
 * credential. So the URL *is* the access control, and a permanent one is no
 * access control at all: it survives the release being deleted, the channel
 * being reassigned, and the device being wiped.
 *
 * The fix is a short-lived signed URL minted per delivery. Two things make it
 * safe to introduce on a system that is already serving:
 *
 *   - The stored value stays as it is. The key is derived from the URL, so
 *     bundles published before this keep working with no migration.
 *   - Signing failure falls back to the stored URL. An update that still
 *     arrives is better than one that does not, and the reason is logged.
 *
 * None of this means anything until the bucket is private: while it is public,
 * the unsigned URL still resolves. That is a change in Supabase, not here.
 */

/** How long a device has to start the download. */
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * The object key inside `bucket`, from a Supabase storage URL.
 *
 * Returns null for anything that is not this bucket's - a release may point at
 * a CDN or a customer's own host, and rewriting that would break it.
 *
 * Handles both spellings Supabase uses: `/object/public/<bucket>/<key>` for a
 * public bucket, and `/object/sign/<bucket>/<key>` for an already-signed one.
 */
export function storageKeyFromUrl(url: string, bucket: string): string | null {
  if (!url || !bucket) return null;

  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }

  for (const kind of ["public", "sign", "authenticated"]) {
    const marker = `/storage/v1/object/${kind}/${bucket}/`;
    const at = pathname.indexOf(marker);

    if (at !== -1) {
      const key = pathname.slice(at + marker.length);
      // A URL that names the bucket and then nothing is not a key.
      return key.length > 0 ? decodeURIComponent(key) : null;
    }
  }

  return null;
}

/** Whether this URL is one we could sign, without doing the work. */
export function isOwnStorage(url: string, bucket: string): boolean {
  return storageKeyFromUrl(url, bucket) !== null;
}
