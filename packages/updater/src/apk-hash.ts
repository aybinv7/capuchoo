import { nativePlugins } from "./optional-plugins.js";
import { Sha256, base64ToBytes } from "./sha256.js";

const CHUNK_BYTES = 512 * 1024;
const STALL_MS = 30_000;

export type ApkHash = { kind: "hashed"; sha256: string } | { kind: "unavailable"; reason: string };

type FilesystemPlugin = Awaited<ReturnType<typeof nativePlugins.filesystem>>["Filesystem"];

interface ReadFileResult {
  data: string | Blob;
}

interface Target {
  Filesystem: FilesystemPlugin;
  directory: never;
  path: string;
}

function asError(value: unknown): Error {
  if (value instanceof Error) return value;
  const message = (value as { message?: unknown } | null)?.message;
  return new Error(typeof message === "string" ? message : String(value));
}

function chunkBytes(result: ReadFileResult | null | undefined): Uint8Array | null {
  const data = result?.data;
  if (data === undefined || data === null || data === "") return null;
  if (typeof data !== "string") throw new Error("the plugin returned a Blob, not base64");
  return base64ToBytes(data);
}

function hashInChunks({ Filesystem, directory, path }: Target): Promise<string> {
  const hash = new Sha256();

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error === undefined) resolve(hash.hex());
      else reject(asError(error));
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new Error("reading the file stalled")), STALL_MS);
    };

    arm();
    Filesystem.readFileInChunks({ path, directory, chunkSize: CHUNK_BYTES }, (chunk, error) => {
      if (settled) return;
      if (error) return finish(error);
      try {
        const bytes = chunkBytes(chunk);
        if (!bytes) return finish();
        hash.update(bytes);
        arm();
      } catch (failure) {
        finish(failure);
      }
    }).catch(finish);
  });
}

async function hashInRanges({ Filesystem, directory, path }: Target): Promise<string> {
  const hash = new Sha256();

  for (let offset = 0; ; offset += CHUNK_BYTES) {
    const bytes = chunkBytes(
      await Filesystem.readFile({ path, directory, offset, length: CHUNK_BYTES }),
    );
    if (!bytes) break;

    hash.update(bytes);
    if (offset === 0 && bytes.length > CHUNK_BYTES) break;
    if (bytes.length < CHUNK_BYTES) break;
  }

  return hash.hex();
}

/**
 * SHA-256 of a file in the cache directory, read in chunks so a 50 MB APK never
 * sits in memory whole. `readFileInChunks` first (Filesystem 7.1+), ranged
 * `readFile` second (8.1+; older versions ignore the range and return the whole
 * file, which is hashed as it is). `unavailable` when neither works.
 */
export async function hashCachedFile(path: string): Promise<ApkHash> {
  let target: Target;
  try {
    const { Directory, Filesystem } = await nativePlugins.filesystem();
    target = { Filesystem, directory: Directory.Cache as never, path };
  } catch (error) {
    return { kind: "unavailable", reason: asError(error).message };
  }

  try {
    return { kind: "hashed", sha256: await hashInChunks(target) };
  } catch (chunked) {
    try {
      return { kind: "hashed", sha256: await hashInRanges(target) };
    } catch (ranged) {
      return {
        kind: "unavailable",
        reason: `chunked read failed (${asError(chunked).message}); ranged read failed (${asError(ranged).message})`,
      };
    }
  }
}
