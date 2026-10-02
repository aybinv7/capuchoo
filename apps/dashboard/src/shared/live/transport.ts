/** What a live transport reports back; the composable owns status, backoff and the cache. */
export interface TransportHandlers {
  /** The server accepted the subscription; `lostEvents` when events may have been missed since. */
  ready(lostEvents: boolean): void;
  event(type: string, data: unknown): void;
  /** Any sign of life, so a silent connection can be told from a quiet one. */
  alive(): void;
  failed(): void;
}

export interface LiveTransport {
  close(): void;
}
