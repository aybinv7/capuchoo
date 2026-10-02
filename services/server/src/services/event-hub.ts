export type HubEventType =
  | "build"
  | "build_event"
  | "build_job"
  | "channel"
  | "device"
  | "artefact";

export interface HubEvent {
  type: HubEventType;
  appId: string;
  data: unknown;
}

type Listener = (event: HubEvent) => void;

/** In-process fan-out of live events to SSE subscribers, per app. */
export class EventHub {
  private readonly listeners = new Map<string, Set<Listener>>();

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
