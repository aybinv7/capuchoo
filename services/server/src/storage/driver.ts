import type { Readable } from "node:stream";

export interface StoredObject {
  size: number;
  contentType: string;
}

export interface ByteRange {
  start: number;
  /** Inclusive. */
  end: number;
}

/** Where artefacts live. Keys are server-generated; drivers never see user input as a path. */
export interface StorageDriver {
  readonly name: "fs" | "s3" | "postgres";
  /** Stores the stream fully or not at all; returns the byte count written. */
  put(key: string, body: Readable, contentType: string): Promise<number>;
  get(key: string, range?: ByteRange): Promise<{ body: Readable } & StoredObject>;
  stat(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  /** A direct, time-limited URL when the backend supports one; otherwise the server streams. */
  directUrl?(key: string, ttlSeconds: number): Promise<string>;
  healthy(): Promise<boolean>;
}

const KEY = /^[a-z0-9][a-z0-9/_.-]{0,254}$/;

/** Refuses anything that could escape the storage root or be ambiguous. */
export function assertStorageKey(key: string): void {
  if (!KEY.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}
