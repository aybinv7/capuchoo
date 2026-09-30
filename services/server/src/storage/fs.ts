import { randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, access } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { assertStorageKey, type ByteRange, type StorageDriver, type StoredObject } from "./driver";

const CONTENT_TYPES: Record<string, string> = {
  ".zip": "application/zip",
  ".apk": "application/vnd.android.package-archive",
  ".aab": "application/octet-stream",
  ".ipa": "application/octet-stream",
};

/** Artefacts on a local volume. Writes land in a temp file and are renamed into place. */
export function createFsStorage(root: string): StorageDriver {
  const base = path.resolve(root);

  const resolve = (key: string): string => {
    assertStorageKey(key);
    const target = path.resolve(base, key);
    if (!target.startsWith(base + path.sep)) throw new Error(`Invalid storage key: ${key}`);
    return target;
  };

  return {
    name: "fs",

    async put(key: string, body: Readable): Promise<number> {
      const target = resolve(key);
      await mkdir(path.dirname(target), { recursive: true });
      const temp = `${target}.${randomBytes(6).toString("hex")}.part`;
      let written = 0;
      body.on("data", (chunk: Buffer) => {
        written += chunk.length;
      });
      try {
        await pipeline(body, createWriteStream(temp, { flags: "wx" }));
        await rename(temp, target);
        return written;
      } catch (error) {
        await rm(temp, { force: true });
        throw error;
      }
    },

    async get(key: string, range?: ByteRange) {
      const target = resolve(key);
      const info = await stat(target);
      const body = createReadStream(target, range ? { start: range.start, end: range.end } : {});
      return {
        body,
        size: info.size,
        contentType: CONTENT_TYPES[path.extname(key)] ?? "application/octet-stream",
      };
    },

    async stat(key: string): Promise<StoredObject | null> {
      try {
        const info = await stat(resolve(key));
        return {
          size: info.size,
          contentType: CONTENT_TYPES[path.extname(key)] ?? "application/octet-stream",
        };
      } catch {
        return null;
      }
    },

    async delete(key: string): Promise<void> {
      await rm(resolve(key), { force: true });
    },

    async healthy(): Promise<boolean> {
      try {
        await mkdir(base, { recursive: true });
        await access(base);
        return true;
      } catch {
        return false;
      }
    },
  };
}
