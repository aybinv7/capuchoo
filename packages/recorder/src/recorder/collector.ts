import type { RecordedEvent, RecordedKind } from "@capuchoo/core";

const MAX_BATCH = 400;
const MAX_DELAY_MS = 1000;

type IdleHandle = { cancel: () => void };

function whenIdle(callback: () => void, timeout: number): IdleHandle {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(callback, { timeout });
    return { cancel: () => cancelIdleCallback(id) };
  }
  const id = setTimeout(callback, Math.min(timeout, 250));
  return { cancel: () => clearTimeout(id) };
}

/**
 * Holds events on the main thread only until the browser is idle, then hands the batch to the
 * pipeline in one structured clone. Nothing is serialized here.
 */
export class EventCollector {
  #events: RecordedEvent[] = [];
  #pending: IdleHandle | null = null;
  readonly #deliver: (events: RecordedEvent[]) => void;

  constructor(deliver: (events: RecordedEvent[]) => void) {
    this.#deliver = deliver;
  }

  push(kind: RecordedKind, data: unknown, time = Date.now()): void {
    this.#events.push({ k: kind, t: time, d: data });
    if (this.#events.length >= MAX_BATCH) this.flush();
    else this.#pending ??= whenIdle(() => this.flush(), MAX_DELAY_MS);
  }

  /** Delivers what is held right now, synchronously. */
  flush(): void {
    this.#pending?.cancel();
    this.#pending = null;
    if (this.#events.length === 0) return;
    const events = this.#events;
    this.#events = [];
    this.#deliver(events);
  }

  discard(): void {
    this.#pending?.cancel();
    this.#pending = null;
    this.#events = [];
  }
}
