import { describe, expect, it } from "vite-plus/test";
import { deltaCacheEntriesToDelete } from "./delta-cache.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

describe("deltaCacheEntriesToDelete", () => {
  it("deletes every cached file when no manifest needs any", () => {
    expect(
      deltaCacheEntriesToDelete([`${HASH_A}_index-abc123.js`, `${HASH_B}_index.html`]),
    ).toEqual([`${HASH_A}_index-abc123.js`, `${HASH_B}_index.html`]);
  });

  it("keeps the files the current manifest still needs", () => {
    expect(
      deltaCacheEntriesToDelete(
        [`${HASH_A}_index-abc123.js`, `${HASH_B}_index.html`],
        new Set([HASH_B]),
      ),
    ).toEqual([`${HASH_A}_index-abc123.js`]);
  });

  it.each([
    ["a partial manifest download", `partial_${HASH_A}_index.js.tmp`],
    ["an atomic-copy temp file", "capgo-123456.tmp"],
    ["a download temp file", "update_42.dat"],
    ["a short hash", `${"a".repeat(63)}_index.js`],
    ["an upper-case hash", `${HASH_A.toUpperCase()}_index.js`],
    ["a hash with no file name", `${HASH_A}_`],
  ])("leaves %s alone", (_label, name) => {
    expect(deltaCacheEntriesToDelete([name])).toEqual([]);
  });
});
