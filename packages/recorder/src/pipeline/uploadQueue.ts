import type { RecordingSegmentMeta } from "@capuchoo/core";
import type { SegmentStore, StoredSegment, StoredSession } from "./segmentStore.js";
import type { Transport } from "./transport.js";

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 60_000;

export interface UploadQueueDeps {
  store: SegmentStore;
  transport: Transport;
  session: (sessionId: string) => StoredSession | undefined;
  allowed: () => boolean;
  onSettled: (session: StoredSession, segment: StoredSegment, outcome: "ok" | "drop") => void;
}

function wire(segment: StoredSegment): RecordingSegmentMeta {
  const { stored: _stored, ...meta } = segment;
  return meta;
}

/**
 * Uploads segments in order, one request at a time, so a session arrives in sequence and a slow
 * link is never asked to carry two. A retryable failure backs off exponentially and resumes from the
 * same segment; a refusal drops it.
 */
export function createUploadQueue(deps: UploadQueueDeps) {
  const pending: Array<{ sessionId: string; seq: number }> = [];
  let pumping = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function schedule(): void {
    if (retryTimer !== null) return;
    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
    attempt++;
    retryTimer = setTimeout(
      () => {
        retryTimer = null;
        void pump();
      },
      delay * (0.5 + Math.random() / 2),
    );
  }

  async function pump(): Promise<void> {
    if (pumping || retryTimer !== null) return;
    pumping = true;
    try {
      while (pending.length > 0 && deps.allowed()) {
        const next = pending[0]!;
        const session = deps.session(next.sessionId);
        const segment = session?.segments.find((candidate) => candidate.seq === next.seq);
        const bytes = segment ? await deps.store.readSegment(next.sessionId, next.seq) : null;
        if (!session || !segment || !bytes) {
          pending.shift();
          continue;
        }
        const outcome = await deps.transport.sendSegment(session.meta, wire(segment), bytes);
        if (outcome === "retry") {
          schedule();
          return;
        }
        attempt = 0;
        pending.shift();
        deps.onSettled(session, segment, outcome);
      }
    } finally {
      pumping = false;
    }
  }

  return {
    enqueue(sessionId: string, seq: number): void {
      if (pending.some((item) => item.sessionId === sessionId && item.seq === seq)) return;
      pending.push({ sessionId, seq });
      void pump();
    },
    resume(): void {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
        attempt = 0;
      }
      void pump();
    },
    get size(): number {
      return pending.length;
    },
    get idle(): boolean {
      return !pumping;
    },
  };
}
