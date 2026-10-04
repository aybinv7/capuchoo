import { EventBacklog } from "./event-backlog";

export type HubEventType =
  | "build"
  | "build_event"
  | "build_job"
  | "channel"
  | "device"
  | "artefact"
  | "recording"
  | "recording_rule"
  | "recorder_health"
  | "assist"
  | "live_watch";

export interface HubEvent {
  type: HubEventType;
  appId: string;
  data: unknown;
}

type Listener = (event: HubEvent) => void;

/** In-process fan-out of live events to SSE subscribers, per app, plus a short backlog for polling. */
export class EventHub {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly waiters = new Map<
    string,
    Set<{ types: readonly HubEventType[]; wake: () => void }>
  >();
  readonly backlog = new EventBacklog();

  /**
   * Resolves `true` when an event of `type` is published for the app, `false` on timeout or abort.
   * Unlike `subscribe`, a waiter costs nothing when other kinds of events are published.
   */
  waitFor(
    appId: string,
    type: HubEventType | readonly HubEventType[],
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const types: readonly HubEventType[] = typeof type === "string" ? [type] : type;
    return new Promise((resolve) => {
      const set = this.waiters.get(appId) ?? new Set();
      this.waiters.set(appId, set);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waiter = {
        types,
        wake: () => finish(true),
      };
      const finish = (woken: boolean) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", aborted);
        set.delete(waiter);
        if (set.size === 0) this.waiters.delete(appId);
        resolve(woken);
      };
      const aborted = () => finish(false);
      if (signal?.aborted) return finish(false);
      set.add(waiter);
      timer = setTimeout(() => finish(false), timeoutMs);
      signal?.addEventListener("abort", aborted, { once: true });
    });
  }

  subscribe(appId: string, listener: Listener): () => void {
    const set = this.listeners.get(appId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(appId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(appId);
    };
  }

  publish(event: HubEvent): void {
    this.backlog.record(event);
    const waiting = this.waiters.get(event.appId);
    if (waiting) {
      for (const waiter of [...waiting]) if (waiter.types.includes(event.type)) waiter.wake();
    }
    const set = this.listeners.get(event.appId);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(event);
      } catch {
        set.delete(listener);
      }
    }
  }

  subscriberCount(appId?: string): number {
    if (appId) return this.listeners.get(appId)?.size ?? 0;
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }
}
