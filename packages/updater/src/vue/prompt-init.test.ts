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
});
