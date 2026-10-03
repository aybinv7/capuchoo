import { randomUUID } from "node:crypto";
import type { Deps } from "../http/context";
import type { MeasuredStream } from "../http/multipart";
import { badRequest } from "../lib/errors";
import { upsertSourceMap } from "../repositories/source-maps";

/** A bundle-relative path to a `.map` file, as the CLI finds it in the web directory. */
const MAP_PATH = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._~@+-][A-Za-z0-9._~@+/-]{0,500}\.map$/;

export const SOURCE_MAP_LIMITS = { bytes: 32 * 1024 * 1024, version: 64 } as const;

export function parseMapTarget(version: string | undefined, path: string | undefined) {
  const versionName = version?.trim();
  if (!versionName || versionName.length > SOURCE_MAP_LIMITS.version) {
    throw badRequest("version is required", "bad_version");
  }
  const mapPath = path?.trim().replace(/^\.?\//, "");
  if (!mapPath || !MAP_PATH.test(mapPath)) {
    throw badRequest("path must be a relative path ending in .map", "bad_path");
  }
  return { versionName, path: mapPath };
}

/** Stores one source map for a version, replacing an earlier upload of the same path. */
export async function storeSourceMap(
  deps: Deps,
  appId: string,
  target: { versionName: string; path: string },
  body: MeasuredStream,
): Promise<{ sizeBytes: number; replaced: boolean }> {
  const key = `source-maps/${appId}/${randomUUID()}`;
  const sizeBytes = await deps.storage.put(key, body.stream, "application/json");
  let previous: string | null;
  try {
    previous = await upsertSourceMap(deps.db, { appId, ...target, storageKey: key, sizeBytes });
  } catch (error) {
    await deps.storage.delete(key).catch(() => undefined);
    throw error;
  }
  if (previous) {
    deps.tasks.run("source map replace", () => deps.storage.delete(previous));
  }
  return { sizeBytes, replaced: previous !== null };
}
