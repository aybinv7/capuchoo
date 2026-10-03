/** The little the relay needs from a WebSocket, so it can be tested without a network. */
export interface AssistSocket {
  send(data: string): void;
  close(code: number, reason: string): void;
  onMessage(handler: (data: string, bytes: number) => void): void;
  onClose(handler: () => void): void;
  /** Bytes queued but not yet sent: how far behind the other end is. */
  readonly buffered: number;
}

/** WebSocket close codes the relay uses (4000-4999 are the application's own). */
export const CLOSE = {
  normal: 1000,
  policy: 1008,
  tooBig: 1009,
  unauthorized: 4001,
  ended: 4002,
  noHello: 4003,
} as const;
