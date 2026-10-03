import { isRecordingSessionId } from "@capuchoo/core";
import type { SegmentStore, StoredSession } from "./segmentStore.js";

const ROOT = "capuchoo-recorder";
const INDEX = "session.json";

interface SyncHandle {
  getSize(): number;
  read(buffer: Uint8Array, options: { at: number }): number;
  write(buffer: Uint8Array, options: { at: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
}

type SyncFileHandle = FileSystemFileHandle & { createSyncAccessHandle(): Promise<SyncHandle> };

/** Synchronous access handles exist only in a dedicated worker; that is the only place this store runs. */
export function opfsAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function" &&
    typeof FileSystemFileHandle !== "undefined" &&
    "createSyncAccessHandle" in FileSystemFileHandle.prototype
  );
}

const segmentName = (seq: number) => `${seq}.gz`;

async function writeFile(dir: FileSystemDirectoryHandle, name: string, bytes: Uint8Array) {
  const file = (await dir.getFileHandle(name, { create: true })) as SyncFileHandle;
  const handle = await file.createSyncAccessHandle();
  try {
    handle.truncate(0);
    handle.write(bytes, { at: 0 });
    handle.flush();
  } finally {
    handle.close();
  }
}

async function readFile(dir: FileSystemDirectoryHandle, name: string): Promise<Uint8Array | null> {
  let file: SyncFileHandle;
  try {
    file = (await dir.getFileHandle(name)) as SyncFileHandle;
  } catch {
    return null;
  }
  const handle = await file.createSyncAccessHandle();
  try {
    const bytes = new Uint8Array(handle.getSize());
    handle.read(bytes, { at: 0 });
    return bytes;
  } finally {
    handle.close();
  }
}

/** One directory per session: an index and one gzip file per segment, each durable once written. */
export async function createOpfsStore(): Promise<SegmentStore> {
  const root = await (
    await navigator.storage.getDirectory()
  ).getDirectoryHandle(ROOT, {
    create: true,
  });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const sessionDir = (sessionId: string, create = true) =>
    root.getDirectoryHandle(sessionId, { create });

  return {
    backend: "opfs",

    async saveSession(session) {
      const dir = await sessionDir(session.meta.sessionId);
      await writeFile(dir, INDEX, encoder.encode(JSON.stringify(session)));
    },

    async writeSegment(sessionId, seq, bytes) {
      await writeFile(await sessionDir(sessionId), segmentName(seq), bytes);
    },

    async readSegment(sessionId, seq) {
      try {
        return await readFile(await sessionDir(sessionId, false), segmentName(seq));
      } catch {
        return null;
      }
    },

    async deleteSegment(sessionId, seq) {
      try {
        await (await sessionDir(sessionId, false)).removeEntry(segmentName(seq));
      } catch {
        return;
      }
    },

    async deleteSession(sessionId) {
      try {
        await root.removeEntry(sessionId, { recursive: true });
      } catch {
        return;
      }
    },

    async listSessions() {
      const sessions: StoredSession[] = [];
      for await (const [name, entry] of (
        root as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }
      ).entries()) {
        if (entry.kind !== "directory" || !isRecordingSessionId(name)) continue;
        const bytes = await readFile(entry as FileSystemDirectoryHandle, INDEX).catch(() => null);
        if (!bytes) {
          await root.removeEntry(name, { recursive: true }).catch(() => undefined);
          continue;
        }
        try {
          sessions.push(JSON.parse(decoder.decode(bytes)) as StoredSession);
        } catch {
          await root.removeEntry(name, { recursive: true }).catch(() => undefined);
        }
      }
      return sessions;
    },
  };
}
