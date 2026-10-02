const KEY = "capuchoo.live.transport";

export type TransportKind = "sse" | "poll";

/** The transport this tab settled on; a stream that never said `ready` is not tried again. */
export function preferredTransport(): TransportKind {
  try {
    return sessionStorage.getItem(KEY) === "poll" ? "poll" : "sse";
  } catch {
    return "sse";
  }
}

export function rememberTransport(kind: TransportKind): void {
  try {
    sessionStorage.setItem(KEY, kind);
  } catch {
    return;
  }
}
