import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { ASSIST_LIMITS } from "@capuchoo/core";
import type { Deps } from "../../http/context";
import { ASSIST_SOCKET_PATH } from "../../routes/assist";
import { relaySocket } from "./relay";
import type { AssistSocket } from "./socket";

/** Under the 60 s a proxy, Render's included, lets a quiet connection live. */
const PING_MS = 25_000;

function adapt(ws: WebSocket): AssistSocket {
  return {
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
    onMessage: (handler) =>
      ws.on("message", (data: RawData, isBinary: boolean) => {
        if (isBinary) {
          ws.close(1003, "text only");
          return;
        }
        const text = data.toString();
        handler(text, Buffer.byteLength(text));
      }),
    onClose: (handler) => ws.on("close", handler),
    get buffered() {
      return ws.bufferedAmount;
    },
  };
}

/**
 * Serves assist sockets on `/api/assist/ws` beside the HTTP API. A socket proves itself with the
 * ticket in its first message, not in the URL, so no secret lands in an access log.
 */
export function attachAssistSockets(server: Server, deps: Deps): () => void {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: ASSIST_LIMITS.deviceMessageBytes + 1024,
    perMessageDeflate: { threshold: 1024 },
  });
  const alive = new WeakSet<WebSocket>();

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = new URL(request.url ?? "/", "http://socket").pathname;
    if (path !== ASSIST_SOCKET_PATH) {
      deps.logger.warn("upgrade refused", { path });
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) => {
      deps.logger.info("assist socket opened", { open: sockets.clients.size });
      alive.add(ws);
      ws.on("pong", () => alive.add(ws));
      relaySocket(adapt(ws), deps.assist, {
        now: () => deps.now().getTime(),
        logger: deps.logger,
      });
    });
  };
  server.on("upgrade", onUpgrade);

  const heartbeat = setInterval(() => {
    for (const ws of sockets.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, PING_MS);
  heartbeat.unref();

  return () => {
    clearInterval(heartbeat);
    server.off("upgrade", onUpgrade);
    deps.assist.closeAll();
    sockets.close();
  };
}
