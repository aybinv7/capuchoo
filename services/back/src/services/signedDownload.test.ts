import { describe, expect, it } from "vite-plus/test";
import { isOwnStorage, storageKeyFromUrl, SIGNED_URL_TTL_SECONDS } from "./signedDownload.js";

const BUCKET = "updates";

/** A real row, as stored today. */
const PUBLIC_URL =
  "https://dubnvfvlaiqzbimgaqvp.supabase.co/storage/v1/object/public/updates/" +
  "bundles/46327222-4e0c-4b42-92a2-d7235d3fae7c/android/dev/bundle-android-0.1.1-1787964579704.zip";

describe("storageKeyFromUrl", () => {
  it("reads the key out of a public URL", () => {
    expect(storageKeyFromUrl(PUBLIC_URL, BUCKET)).toBe(
      "bundles/46327222-4e0c-4b42-92a2-d7235d3fae7c/android/dev/bundle-android-0.1.1-1787964579704.zip",
    );
  });

  /**
   * Every bundle published before signing existed stores a public URL. Deriving
   * the key from it is what lets those keep working with no migration.
   */
  it("works on rows written before any of this existed", () => {
    expect(storageKeyFromUrl(PUBLIC_URL, BUCKET)).not.toBeNull();
  });

  it("reads an already-signed URL too", () => {
    const signed = PUBLIC_URL.replace("/object/public/", "/object/sign/") + "?token=abc";

    expect(storageKeyFromUrl(signed, BUCKET)).toContain("bundle-android-0.1.1");
  });

  it("decodes an escaped key", () => {
    const url = `https://x.supabase.co/storage/v1/object/public/${BUCKET}/a%20b/c.zip`;

    expect(storageKeyFromUrl(url, BUCKET)).toBe("a b/c.zip");
  });

  /**
   * A release may point at a CDN or a customer's own host. Rewriting that would
   * break it, so anything not ours is left alone.
   */
  it("returns null for another bucket", () => {
    const other = PUBLIC_URL.replace("/updates/", "/somebody-elses/");

    expect(storageKeyFromUrl(other, BUCKET)).toBeNull();
  });

  it("returns null for a URL that is not Supabase storage", () => {
    expect(storageKeyFromUrl("https://cdn.example.com/bundle.zip", BUCKET)).toBeNull();
  });

  it("returns null rather than throwing on rubbish", () => {
    expect(storageKeyFromUrl("not a url", BUCKET)).toBeNull();
    expect(storageKeyFromUrl("", BUCKET)).toBeNull();
  });

  it("returns null when the bucket is named but the key is empty", () => {
    expect(
      storageKeyFromUrl(`https://x.supabase.co/storage/v1/object/public/${BUCKET}/`, BUCKET),
    ).toBeNull();
  });

  it("does not match a bucket whose name is a prefix of ours", () => {
    // `updates-archive` is not `updates`, and the trailing slash is what says so.
    const url = `https://x.supabase.co/storage/v1/object/public/updates-archive/a.zip`;

    expect(storageKeyFromUrl(url, BUCKET)).toBeNull();
  });

  it("needs a bucket to compare against", () => {
    expect(storageKeyFromUrl(PUBLIC_URL, "")).toBeNull();
  });
});

describe("isOwnStorage", () => {
  it("says yes only for this bucket", () => {
    expect(isOwnStorage(PUBLIC_URL, BUCKET)).toBe(true);
    expect(isOwnStorage("https://cdn.example.com/x.zip", BUCKET)).toBe(false);
  });
});

describe("the expiry", () => {
  it("is long enough to start a large download on a slow connection", () => {
    // A 17.7 MiB APK was published today; a device on poor mobile data needs
    // more than a couple of minutes to begin one.
    expect(SIGNED_URL_TTL_SECONDS).toBeGreaterThanOrEqual(600);
  });

  it("is short enough that a leaked link is not a permanent one", () => {
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(24 * 3600);
  });
});
