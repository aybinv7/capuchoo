import type { RecordingSegmentMeta, RecordingSessionMeta } from "@capuchoo/core";

/** A segment as kept on the device: its wire metadata and its compressed size. */
export interface StoredSegment extends RecordingSegmentMeta {
  stored: number;
}

/** A session as the device keeps it until every segment is uploaded. */
export interface StoredSession {
  meta: RecordingSessionMeta;
  /** Promoted sessions upload; the rest are a ring buffer nobody asked for yet. */
  promoted: boolean;
  /** Segments kept on the device, not yet uploaded. */
  segments: StoredSegment[];
}

export interface SegmentStore {
  readonly backend: "opfs" | "memory";
  saveSession(session: StoredSession): Promise<void>;
  writeSegment(sessionId: string, seq: number, bytes: Uint8Array): Promise<void>;
  readSegment(sessionId: string, seq: number): Promise<Uint8Array | null>;
  deleteSegment(sessionId: string, seq: number): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<StoredSession[]>;
}

export function createMemoryStore(): SegmentStore {
  const sessions = new Map<string, StoredSession>();
  const segments = new Map<string, Uint8Array>();
  const key = (sessionId: string, seq: number) => `${sessionId}/${seq}`;

  return {
    backend: "memory",
    async saveSession(session) {
      sessions.set(session.meta.sessionId, structuredClone(session));
    },
    async writeSegment(sessionId, seq, bytes) {
      segments.set(key(sessionId, seq), bytes);
    },
    async readSegment(sessionId, seq) {
      return segments.get(key(sessionId, seq)) ?? null;
    },
    async deleteSegment(sessionId, seq) {
      segments.delete(key(sessionId, seq));
    },
    async deleteSession(sessionId) {
      sessions.delete(sessionId);
      for (const name of segments.keys()) {
        if (name.startsWith(`${sessionId}/`)) segments.delete(name);
      }
    },
    async listSessions() {
      return [...sessions.values()].map((session) => structuredClone(session));
    },
  };
}
