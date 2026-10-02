import type { HubEvent } from "./event-hub";

const MAX_EVENTS_PER_APP = 500;
const MAX_AGE_MS = 5 * 60_000;

interface Entry {
  seq: number;
  at: number;
  event: HubEvent;
}

interface AppLog {
  entries: Entry[];
  /** Highest sequence number pruned away; a cursor at or below it has missed events. */
  floor: number;
}

export interface BacklogPage {
  cursor: number;
  events: HubEvent[];
  /** The cursor predates what is kept: the caller missed events and must refetch. */
  reset: boolean;
}

/**
 * The recent events of each app, numbered, so a client that cannot hold a stream open (a proxy
 * that buffers it) can ask for what happened after its cursor. Bounded per app by count and age.
 */
export class EventBacklog {
  private seq = 0;
  private readonly logs = new Map<string, AppLog>();
  private readonly waiters = new Map<string, Set<() => void>>();

  constructor(private readonly clock: () => number = Date.now) {}

  get cursor(): number {
    return this.seq;
  }

  record(event: HubEvent): void {
    this.seq += 1;
    const log = this.logs.get(event.appId) ?? { entries: [], floor: 0 };
    log.entries.push({ seq: this.seq, at: this.clock(), event });
    this.prune(log);
    this.logs.set(event.appId, log);
    const waiting = this.waiters.get(event.appId);
    if (waiting) for (const wake of waiting) wake();
  }

  /** Events of `appId` after `cursor`, oldest first; the returned cursor is the global head. */
  after(appId: string, cursor: number): BacklogPage {
    const log = this.logs.get(appId);
    if (!log) return { cursor: this.seq, events: [], reset: false };
    this.prune(log);
    return {
      cursor: this.seq,
      events: log.entries.filter((entry) => entry.seq > cursor).map((entry) => entry.event),
      reset: cursor < log.floor,
    };
  }

  /** Resolves when `appId` records an event, after `timeoutMs`, or when `signal` aborts. */
  wait(appId: string, timeoutMs: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const set = this.waiters.get(appId) ?? new Set<() => void>();
      const done = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", done);
        set.delete(done);
        if (set.size === 0) this.waiters.delete(appId);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      set.add(done);
      this.waiters.set(appId, set);
      if (signal?.aborted) done();
      else signal?.addEventListener("abort", done, { once: true });
    });
  }

  private prune(log: AppLog): void {
    const oldest = this.clock() - MAX_AGE_MS;
    let drop = 0;
    while (
      drop < log.entries.length &&
      (log.entries.length - drop > MAX_EVENTS_PER_APP || log.entries[drop]!.at < oldest)
    )
      drop += 1;
    if (drop === 0) return;
    log.floor = log.entries[drop - 1]!.seq;
    log.entries.splice(0, drop);
  }
}
