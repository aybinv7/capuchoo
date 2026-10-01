import type { Dialect } from "kysely";

/**
 * Every engine this template offers, as values rather than only as a type.
 *
 * A types-only union cannot be read at runtime, and everything that needs the list had to invent
 * its own copy: `@cavulsqa/create` was regexing this very file to populate `--engine`, and
 * `localStorage`'s override was cast rather than checked.
 */
export const STORAGE_IDS = [
  "sqlite-wasm-opfs-sahpool",
] as const;

export type StorageId = (typeof STORAGE_IDS)[number];

export function isStorageId(value: string): value is StorageId {
  return (STORAGE_IDS as readonly string[]).includes(value);
}

/**
 * A union rather than an optional field, so an unsupported probe cannot forget its reason and a
 * supported one cannot carry a stale one.
 */
export type StorageProbe = { supported: true } | { supported: false; reason: string };

/**
 * One way to persist SQLite, described well enough to choose between them without reading the code.
 *
 * A candidate is not a config flag: it owns its own capability check and its own lazy import, so a
 * chain that never reaches the fourth entry never downloads the fourth entry's wasm.
 */
export interface StorageCandidate {
  id: StorageId;
  label: string;
  /** What it costs. Every entry has one, and an entry claiming none is a lie. */
  tradeoff: string;
  durable: boolean;
  /**
   * Whether the numbers behind its position in the chain came from a device or from a vendor's
   * README. Only one entry is currently `measured`, and the ordering says so rather than implying
   * more confidence than we have.
   */
  evidence: "measured" | "expected";
  probe: () => StorageProbe;
  createDialect: () => Promise<Dialect>;
}

export interface StorageAttempt {
  id: StorageId;
  outcome: "opened" | "unsupported" | "failed";
  detail?: string;
}
