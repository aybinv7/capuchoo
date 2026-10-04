import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import type { RecordedEvent } from "@capuchoo/core";
import type { Deps } from "../../http/context";
import { listSegments } from "../../repositories/recording-sessions";

/** Most of a session is the screen; the timeline never needs it, so those lines are skipped unparsed. */
const SCREEN_PREFIX = '{"k":"replay"';
/** What one call may decompress, so a huge session cannot pin the server. */
export const TIMELINE_READ_LIMIT = 48 * 1024 * 1024;

export interface SessionLines {
  lines: RecordedEvent[];
  /** The read stopped at the limit; later lines are missing. */
  truncated: boolean;
}

/**
 * The session's non-screen lines in order: segment by segment from storage, gunzipped as a stream
 * and split into lines, so memory holds the lines kept rather than the session.
 */
export async function readSessionLines(deps: Deps, sessionId: string): Promise<SessionLines> {
  const segments = await listSegments(deps.db, sessionId);
  const lines: RecordedEvent[] = [];
  let read = 0;
  for (const segment of segments) {
    const object = await deps.storage.get(segment.storage_key).catch(() => null);
    if (!object) continue;
    const gunzip = createGunzip();
    gunzip.on("data", (chunk: Buffer) => {
      read += chunk.length;
      if (read > TIMELINE_READ_LIMIT) gunzip.destroy();
    });
    object.body.on("error", () => gunzip.destroy());
    const reader = createInterface({ input: object.body.pipe(gunzip), crlfDelay: Infinity });
    try {
      for await (const line of reader) {
        if (!line || line.startsWith(SCREEN_PREFIX)) continue;
        try {
          const event = JSON.parse(line) as RecordedEvent;
          if (typeof event?.k === "string" && typeof event.t === "number") lines.push(event);
        } catch {
          continue;
        }
      }
    } catch {
      return { lines, truncated: true };
    }
    if (read > TIMELINE_READ_LIMIT) return { lines, truncated: true };
  }
  return { lines, truncated: false };
}
