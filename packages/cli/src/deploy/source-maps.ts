import fs from "node:fs/promises";
import type { CloudClient } from "../services/cloud.js";

const CONCURRENCY = 4;

export interface SourceMapUpload {
  uploaded: number;
  failed: Array<{ path: string; reason: string }>;
}

/**
 * Sends the build's source maps after the bundle is accepted. Best effort: a release is not undone
 * because a map failed; the failures come back so the deploy can say which.
 */
export async function uploadSourceMaps(input: {
  cloud: CloudClient;
  cloudAppId: string;
  versionName: string;
  maps: ReadonlyArray<{ path: string; file: string }>;
}): Promise<SourceMapUpload> {
  const result: SourceMapUpload = { uploaded: 0, failed: [] };
  const queue = [...input.maps];

  async function worker(): Promise<void> {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const map: unknown = JSON.parse(await fs.readFile(next.file, "utf8"));
        await input.cloud.uploadSourceMap(input.cloudAppId, input.versionName, next.path, map);
        result.uploaded++;
      } catch (error) {
        result.failed.push({
          path: next.path,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return result;
}
