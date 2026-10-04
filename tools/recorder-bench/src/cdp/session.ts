import type { Adb } from "../device/adb.ts";

const CALL_TIMEOUT_MS = 30_000;

interface Target {
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface CdpSession {
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  /** Evaluates an expression in the page and returns its value; promises are awaited. */
  evaluate<T = unknown>(expression: string): Promise<T>;
  close(): Promise<void>;
}

/**
 * DevTools on the app's WebView, through the abstract socket a debuggable WebView opens per process.
 * The forward uses a free local port and is removed on close.
 */
export async function connectToWebView(adb: Adb, appPid: number): Promise<CdpSession> {
  const forwarded = (
    await adb.run(["forward", "tcp:0", `localabstract:webview_devtools_remote_${appPid}`])
  ).trim();
  const port = Number(forwarded);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`adb forward gave "${forwarded}"`);

  const release = () => adb.run(["forward", "--remove", `tcp:${port}`]).catch(() => "");
  try {
    const targets = await fetchTargets(port);
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (!page?.webSocketDebuggerUrl) throw new Error("The WebView exposes no page target yet");
    const socket = await open(page.webSocketDebuggerUrl.replace("localhost", "127.0.0.1"));
    return session(socket, release);
  } catch (error) {
    await release();
    throw error;
  }
}

async function fetchTargets(port: number): Promise<Target[]> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = (await response.json()) as Target[];
      if (targets.some((target) => target.type === "page")) return targets;
    } catch (error) {
      if (attempt >= 20) throw error;
    }
    if (attempt >= 20) return [];
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function open(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", () => reject(new Error(`Cannot open ${url}`)), { once: true });
  });
}

function session(socket: WebSocket, release: () => Promise<unknown>): CdpSession {
  let nextId = 0;
  const pending = new Map<number, Pending>();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as {
      id?: number;
      result?: unknown;
      error?: { message: string };
    };
    if (message.id === undefined) return;
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    clearTimeout(call.timer);
    if (message.error) call.reject(new Error(message.error.message));
    else call.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const call of pending.values()) {
      clearTimeout(call.timer);
      call.reject(new Error("The DevTools connection closed"));
    }
    pending.clear();
  });

  const send = <T>(method: string, params: Record<string, unknown> = {}) =>
    new Promise<T>((resolve, reject) => {
      if (socket.readyState !== WebSocket.OPEN) {
        reject(new Error("The DevTools connection is closed"));
        return;
      }
      const id = (nextId += 1);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, CALL_TIMEOUT_MS);
      pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });

  return {
    send,
    async evaluate<T>(expression: string) {
      const result = await send<{
        result: { value?: T };
        exceptionDetails?: { text: string; exception?: { description?: string } };
      }>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
        );
      }
      return result.result.value as T;
    },
    async close() {
      socket.close();
      await release();
    },
  };
}
