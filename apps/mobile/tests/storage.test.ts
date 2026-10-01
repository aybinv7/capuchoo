import { afterEach, expect, test } from "vite-plus/test";
import { DEFAULT_ORDER, storageChain } from "../src/app/storage.config.js";
import {
  describeOpenFailure,
  MINIMUM_CHROMIUM_FOR_OPFS,
  probeOpfsCapable,
  webviewLikelyTooOld,
  webviewVersion,
} from "../src/shared/database/storage.js";

const original = globalThis.navigator;

afterEach(() => {
  if (original)
    Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
});

function withNavigator(value: unknown): void {
  Object.defineProperty(globalThis, "navigator", { value, configurable: true });
}

/**
 * The regression this exists for: the probe used to require `createSyncAccessHandle` on
 * `FileSystemFileHandle.prototype`. That method is Worker-only in Chromium, so it is absent on the
 * main thread of every device - and the check rejected a phone on WebView 150 that had been running
 * OPFS for hours. A main-thread probe may only look at what the main thread can see.
 */
test("a WebView that supports OPFS passes even without the worker-only method", () => {
  withNavigator({ storage: { getDirectory: () => Promise.resolve({}) } });
  expect("createSyncAccessHandle" in (globalThis.FileSystemFileHandle?.prototype ?? {})).toBe(
    false,
  );
  expect(probeOpfsCapable().supported).toBe(true);
});

test("a WebView with no OPFS at all is refused, and told what to do", () => {
  withNavigator({ storage: {} });
  const probe = probeOpfsCapable();
  expect(probe.supported).toBe(false);
  expect(probe.reason).toMatch(/Android System WebView/);
});

test("an open failure is translated into something actionable", () => {
  const sah = describeOpenFailure(new Error("createSyncAccessHandle is not a function"));
  expect(sah).toMatch(/Android System WebView/);
  // The other cause of the same failure, and the one a person can actually fix themselves.
  expect(sah).toMatch(/still holds the database open/);
  // The engine's own words are kept, so a bug report has something to go on.
  expect(sah).toContain("createSyncAccessHandle is not a function");

  expect(describeOpenFailure(new Error("disk I/O error"))).toBe(
    "The database could not be opened: disk I/O error",
  );
});

/**
 * The chain is a claim about ordering, so it is checked like one: fastest first, durable before
 * volatile, and nothing in it without a stated cost.
 */
test("the storage chain is ordered and honest about what each entry costs", () => {
  expect(storageChain.length).toBeGreaterThan(0);

  // The ranking is asserted against the default order, not the live chain: VITE_STORAGE_ENGINE
  // reorders the chain on purpose, and a generated app that chose another engine is not broken.
  expect(DEFAULT_ORDER[0]?.id).toBe("sqlite-wasm-opfs-sahpool");
  expect(DEFAULT_ORDER[0]?.evidence).toBe("measured");

  // Whatever the environment asked for, the chain must still be every candidate exactly once -
  // promoting one may not drop the others, or the fallback silently disappears.
  expect([...storageChain].sort((a, b) => (a.id < b.id ? -1 : 1))).toEqual(
    [...DEFAULT_ORDER].sort((a, b) => (a.id < b.id ? -1 : 1)),
  );

  for (const candidate of DEFAULT_ORDER) {
    expect(candidate.tradeoff.length, candidate.id).toBeGreaterThan(20);
    expect(candidate.label.length, candidate.id).toBeGreaterThan(5);
  }

  // Nothing in the chain may be volatile: a silent stop somewhere data is not kept is worse than
  // an error that names every attempt.
  expect(storageChain.filter((candidate) => !candidate.durable)).toEqual([]);

  // Every engine gets a probe of its own; sharing one would hide that IndexedDB needs no OPFS.
  expect(storageChain.every((candidate) => typeof candidate.probe === "function")).toBe(true);

  // Ids are unique, or results keyed by id would overwrite each other.
  expect(new Set(storageChain.map((c) => c.id)).size).toBe(storageChain.length);
});

/** The floor is reported, never enforced: a vendor build can differ, so it informs and nothing else. */
test("the WebView version is read from the user agent and judged against the floor", () => {
  withNavigator({
    storage: { getDirectory: () => Promise.resolve({}) },
    userAgent: "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/150.0.7871.183 Mobile",
  });
  expect(webviewVersion()).toBe(150);
  expect(webviewLikelyTooOld()).toBe(false);
  // Support is still asserted, because the floor must not become a second gate on a working device.
  expect(probeOpfsCapable().supported).toBe(true);

  withNavigator({
    storage: { getDirectory: () => Promise.resolve({}) },
    userAgent: "Mozilla/5.0 (Linux; Android 7.0) AppleWebKit/537.36 Chrome/51.0.2704.90 Mobile",
  });
  expect(webviewVersion()).toBe(51);
  expect(webviewLikelyTooOld()).toBe(true);

  withNavigator({
    storage: { getDirectory: () => Promise.resolve({}) },
    userAgent: "something else",
  });
  expect(webviewVersion()).toBe(null);
  // Unknown is not old: an unparseable agent must not lock anybody out.
  expect(webviewLikelyTooOld()).toBe(false);

  expect(MINIMUM_CHROMIUM_FOR_OPFS).toBe(109);
});
