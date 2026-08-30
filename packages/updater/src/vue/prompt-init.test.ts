import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

/**
 * A prompt that never checks is furniture.
 *
 * `useUpdater` is the low-level API and deliberately lets an app choose when to
 * begin. `useUpdatePrompt` exists to drive a dialog, and mounting a component
 * built on it used to do nothing at all: on a real device, with a required
 * update published and waiting, no dialog appeared and nothing said why.
 *
 * Asserted on the source rather than by rendering, because the composable
 * touches Capacitor plugins that do not exist off-device - and the property
 * being protected is simply that the call is there.
 */
const source = fs.readFileSync(path.join(import.meta.dirname, "useUpdatePrompt.ts"), "utf8");

describe("useUpdatePrompt", () => {
  it("starts the updater itself", () => {
    expect(source).toContain("updater.init()");
  });

  it("does so before deriving anything from the state", () => {
    // Otherwise the first render reads a state nothing has populated.
    const init = source.indexOf("updater.init()");
    const derived = source.indexOf("const facts = computed");

    expect(init).toBeGreaterThan(-1);
    expect(init).toBeLessThan(derived);
  });

  it("does not await it, so a slow backend cannot block setup", () => {
    // The backend sleeps; a composable that awaited its first check would hold
    // component setup for up to ninety seconds.
    expect(source).toContain("void updater.init()");
  });

  /**
   * Not awaiting is right; discarding the rejection is not.
   *
   * A bare `void updater.init()` sent a real start-up failure nowhere at all.
   * On a device with a required update published and waiting, the whole symptom
   * was an app that showed nothing and logged nothing - the promise rejected
   * into a `void` and the flag stayed set, so nothing ever retried.
   */
  it("reports a start-up failure instead of discarding it", () => {
    expect(source).toContain(".catch(");
    expect(source).toContain("[capuchoo]");
  });
});

/**
 * The failure itself: `getVersionCode` was called and never imported.
 *
 * `vp pack` does not type check, so this reached npm as 0.7.2 and only spoke on
 * a device, through a probe:
 *
 *   init THREW: getVersionCode is not defined
 *
 * The import is now asserted here, and every package runs `tsc` - see the root
 * `typecheck` task, which is what should have caught it.
 */
const updater = fs.readFileSync(path.join(import.meta.dirname, "useUpdater.ts"), "utf8");

function withoutComments(text: string): string {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/.*$/gm, "");
}

describe("init", () => {
  /**
   * Housekeeping must not be able to cost the check. Pruning the APK cache and
   * attaching listeners are conveniences; asking whether an update exists is the
   * entire purpose, and it used to sit behind all of them with no guard.
   */
  it("checks for an update even when a start-up step fails", () => {
    const body = withoutComments(updater);
    const guard = body.indexOf("try {");
    const prune = body.indexOf("await pruneApkCache");
    const rescue = body.indexOf("} catch (error) {", prune);
    const check = body.indexOf("await check(true)");

    expect(guard).toBeLessThan(prune);
    expect(prune).toBeLessThan(rescue);
    expect(rescue).toBeLessThan(check);
  });

  it("says so when a start-up step fails", () => {
    expect(updater).toContain("updater start-up step failed");
  });
});
