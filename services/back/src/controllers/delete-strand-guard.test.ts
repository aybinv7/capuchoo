import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Deleting a release a channel is actively serving used to be silent.
 *
 * `findAssignedBundle` and `findAssignedNative` both resolve a channel's
 * pointer with `.maybeSingle()` and return null on a miss. Nothing clears the
 * pointer when the row it points at is deleted, so `deleteBundle` and
 * `deleteNativeUpdate` could remove a row a channel still points to and answer
 * 204 - the channel then silently stops serving it, exactly the failure mode
 * `assertNativeGateSatisfiable` and `assertChannelPointersConsistent` exist to
 * prevent at every other write path.
 *
 * This one was reachable only from the API directly until this session wired
 * the dashboard's Delete buttons to it - before that, nothing in the UI could
 * trigger it at all.
 */
const admin = fs.readFileSync(path.join(import.meta.dirname, "adminController.ts"), "utf8");
const native = fs.readFileSync(path.join(import.meta.dirname, "nativeUpdateController.ts"), "utf8");

function handlerBody(source: string, name: string): string {
  const start = source.indexOf(`async ${name}(`);
  return source.slice(start, start + 2000);
}

describe("deleting a bundle checks who is serving it first", () => {
  const body = handlerBody(admin, "deleteBundle");

  it("looks up channels pointing at this id before deleting", () => {
    const lookup = body.indexOf('eq("current_version_id", id)');
    const del = body.indexOf('this.supabaseService.delete("app_versions"');

    expect(lookup).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(-1);
    expect(lookup).toBeLessThan(del);
  });

  it("refuses rather than deleting when a channel is found", () => {
    expect(body).toContain("throw new ValidationError");
    expect(body).toContain("currently served by");
  });
});

describe("deleting a native build checks who is serving it first", () => {
  const body = handlerBody(native, "deleteNativeUpdate");

  it("looks up channels pointing at this id before deleting", () => {
    const lookup = body.indexOf('eq("current_native_version_id", id)');
    const del = body.indexOf('this.supabaseService.delete("native_updates"');

    expect(lookup).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(-1);
    expect(lookup).toBeLessThan(del);
  });

  it("refuses rather than deleting when a channel is found", () => {
    expect(body).toContain("throw new ValidationError");
    expect(body).toContain("currently served by");
  });
});
