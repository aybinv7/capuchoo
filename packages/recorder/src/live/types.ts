/** The little of a WebSocket a live stream uses, so tests can stand in for the network. */
export interface LiveSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open" | "close" | "error", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}

/** The recorder's screen, as a live stream reads it. */
export interface ScreenSource {
  /** Every replay event as the recorder emits it. */
  subscribe(listener: (event: unknown) => void): () => void;
  /** Makes sure the screen is being recorded; the returned function lets it go. */
  acquire(): () => void;
  /** Emits a full snapshot now. */
  snapshot(): void;
}
