import {
  parseAgentMessage,
  type AgentMessage,
  type AssistControl,
  type AssistEndReason,
  type AssistInvite,
} from "@capuchoo/core";
import { createScreenStream, type ScreenStream } from "../live/screenStream.js";
import type { ScreenSource } from "../live/types.js";
import type { RecorderLogger } from "../recorder/types.js";
import { AssistOverlay } from "./overlay.js";
import { key, scroll, tap, typeText, type InputGuards, type InputResult } from "./remoteInput.js";
import { DEFAULT_TEXTS, type AssistOptions, type AssistSocketLike } from "./types.js";

const CONTROL_ASK_MS = 60_000;
const OPEN = 1;

export interface AssistHost {
  /** The server's origin. */
  endpoint: string;
  screen: ScreenSource;
  /** Notes what assist did in the session's recording. */
  mark(data: Record<string, unknown>): void;
  guards(): Omit<InputGuards, "overlay">;
  logger: RecorderLogger;
  connect?: (url: string) => AssistSocketLike;
  post?: (url: string, body: unknown) => Promise<unknown>;
}

interface Active {
  invite: AssistInvite;
  overlay: AssistOverlay;
  socket: AssistSocketLike | null;
  control: AssistControl;
  stream: ScreenStream | null;
}

/**
 * One assist session on the device: the user's consent, the socket to the server, the screen
 * streamed to the agent, and the agent's pointer and - only after a second consent - their taps.
 * Leaving the app, the Stop button, or either side going away ends it.
 */
export function createAssist(options: AssistOptions, host: AssistHost) {
  const texts = { ...DEFAULT_TEXTS, ...options.texts };
  const connect = host.connect ?? ((url: string) => new WebSocket(url) as AssistSocketLike);
  const post =
    host.post ??
    ((url: string, body: unknown) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        credentials: "omit",
      }));
  let active: Active | null = null;

  const send = (current: Active, message: object) => {
    if (current.socket?.readyState !== OPEN) return;
    try {
      current.socket.send(JSON.stringify(message));
    } catch (error) {
      host.logger.warn("assist message failed", error);
    }
  };

  function startStreaming(current: Active): void {
    if (current.stream || !current.socket) return;
    current.stream = createScreenStream(current.socket, host.screen);
    current.stream.start();
    current.overlay.showBanner("viewing", current.invite.agent, () =>
      finish(current, "user", true),
    );
    host.mark({ kind: "assist", event: "start", agent: current.invite.agent });
  }

  function setControl(current: Active, control: AssistControl): void {
    current.control = control;
    send(current, { t: "control", state: control });
    current.overlay.shieldUser(
      control === "granted",
      texts.shielded.replaceAll("{agent}", current.invite.agent),
    );
    current.overlay.showBanner(
      control === "granted" ? "controlling" : "viewing",
      current.invite.agent,
      () => finish(current, "user", true),
    );
    if (control === "granted" || control === "none") {
      host.mark({ kind: "assist", event: control === "granted" ? "control" : "release" });
    }
  }

  async function askControl(current: Active): Promise<void> {
    if (options.control === false) {
      send(current, { t: "control", state: "denied" });
      return;
    }
    send(current, { t: "control", state: "asked" });
    const granted = await current.overlay.ask("control", current.invite.agent, CONTROL_ASK_MS);
    if (active !== current) return;
    setControl(current, granted ? "granted" : "denied");
  }

  function act(current: Active, message: AgentMessage): void {
    const guards = { ...host.guards(), overlay: current.overlay.host };
    let result: InputResult;
    switch (message.t) {
      case "tap":
        current.overlay.pointer(message.x, message.y, current.invite.agent);
        current.overlay.ripple(message.x, message.y);
        result = current.overlay.passThrough(() => tap(message.x, message.y, guards));
        break;
      case "scroll":
        result = current.overlay.passThrough(() =>
          scroll(message.x, message.y, message.dx, message.dy, guards),
        );
        break;
      case "type":
        result = current.overlay.passThrough(() => typeText(message.text, guards));
        break;
      case "key":
        result = current.overlay.passThrough(() => key(message.key, guards));
        break;
      default:
        return;
    }
    if (!result.ok) send(current, { t: "refused", action: message.t, reason: result.reason });
  }

  function onAgent(current: Active, message: AgentMessage): void {
    switch (message.t) {
      case "pointer":
        current.overlay.pointer(message.x, message.y, current.invite.agent);
        return;
      case "pointer-off":
        current.overlay.hidePointer();
        return;
      case "control":
        if (current.control !== "granted" && current.control !== "asked") void askControl(current);
        return;
      case "release":
        if (current.control === "granted") setControl(current, "none");
        return;
      case "end":
        finish(current, "agent", false);
        return;
      default:
        if (current.control !== "granted") {
          send(current, { t: "refused", action: message.t, reason: "Control was not given." });
          return;
        }
        act(current, message);
    }
  }

  function onMessage(current: Active, data: unknown): void {
    let raw: unknown;
    try {
      raw = JSON.parse(String(data));
    } catch {
      return;
    }
    const server = raw as { t?: string; reason?: AssistEndReason };
    if (server.t === "ready") {
      startStreaming(current);
      return;
    }
    if (server.t === "end") {
      finish(current, server.reason ?? "agent", false);
      return;
    }
    if (server.t === "error") {
      const code = (raw as { code?: string }).code;
      if (code === "unauthorized" || code === "no_hello" || code === "too_big") {
        finish(current, "error", false);
      }
      return;
    }
    if (server.t === "peer") return;
    const message = parseAgentMessage(raw);
    if (message) onAgent(current, message);
  }

  function finish(current: Active, reason: AssistEndReason, tell: boolean): void {
    if (active !== current) return;
    active = null;
    if (tell) send(current, { t: "end", reason });
    current.stream?.stop();
    current.overlay.destroy();
    if (current.stream) host.mark({ kind: "assist", event: "end", reason });
    try {
      current.socket?.close(1000, reason);
    } catch {
      return;
    }
  }

  function onHidden(): void {
    if (active && document.visibilityState === "hidden") finish(active, "background", true);
  }
  document.addEventListener("visibilitychange", onHidden);

  return {
    /** An invite from the policy answer: asks the user, then joins if they agree. */
    async invite(invite: AssistInvite): Promise<void> {
      if (active?.invite.session === invite.session) return;
      if (active) finish(active, "replaced", true);
      const remaining = invite.expiresAt - Date.now();
      if (remaining <= 0 || document.visibilityState === "hidden") return;

      const dir = options.dir ?? (document.documentElement.dir === "rtl" ? "rtl" : "ltr");
      const current: Active = {
        invite,
        overlay: new AssistOverlay(texts, dir),
        socket: null,
        control: "none",
        stream: null,
      };
      active = current;
      const accepted = await current.overlay.ask("view", invite.agent, remaining);
      if (active !== current) return;
      if (!accepted) {
        active = null;
        current.overlay.destroy();
        void post(`${host.endpoint}/api/recording/assist/decline`, {
          session: invite.session,
          ticket: invite.ticket,
        }).catch((error: unknown) => host.logger.warn("assist decline failed", error));
        return;
      }

      const url = `${host.endpoint.replace(/^http/, "ws")}/api/assist/ws`;
      let socket: AssistSocketLike;
      try {
        socket = connect(url);
      } catch (error) {
        host.logger.warn("assist connection failed", error);
        finish(current, "error", false);
        return;
      }
      current.socket = socket;
      socket.addEventListener("open", () =>
        socket.send(
          JSON.stringify({
            t: "hello",
            session: invite.session,
            role: "device",
            ticket: invite.ticket,
          }),
        ),
      );
      socket.addEventListener("message", (event) => onMessage(current, event.data));
      socket.addEventListener("close", () => finish(current, "error", false));
      socket.addEventListener("error", () => host.logger.warn("assist socket error"));
    },

    /** The session id while one runs. */
    get session(): string | null {
      return active?.invite.session ?? null;
    },

    stop(): void {
      if (active) finish(active, "user", true);
      document.removeEventListener("visibilitychange", onHidden);
    },
  };
}

export type Assist = ReturnType<typeof createAssist>;
