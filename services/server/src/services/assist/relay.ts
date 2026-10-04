import {
  ASSIST_LIMITS,
  CONTROL_MESSAGES,
  parseAgentMessage,
  parseAssistHello,
  parseDeviceMessage,
  type AssistRole,
  type ServerMessage,
} from "@capuchoo/core";
import type { Logger } from "../../lib/logger";
import type { AssistRegistry, AssistSession } from "./registry";
import { CLOSE, type AssistSocket } from "./socket";

/** Past this many bytes queued for the agent, screen events are dropped rather than buffered. */
const MAX_AGENT_BACKLOG = 16 * 1024 * 1024;

/** A per-socket allowance of messages per second, refilled continuously. */
class Allowance {
  private tokens: number;
  private last: number;

  constructor(
    private readonly perSecond: number,
    private readonly now: () => number,
  ) {
    this.tokens = perSecond;
    this.last = now();
  }

  take(): boolean {
    const now = this.now();
    this.tokens = Math.min(
      this.perSecond,
      this.tokens + ((now - this.last) / 1000) * this.perSecond,
    );
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** Sends a message to one side; a socket that fails is closing and its close ends the session. */
const post = (socket: AssistSocket | undefined, message: object) => {
  try {
    socket?.send(JSON.stringify(message));
  } catch {
    return;
  }
};
const tell = (socket: AssistSocket | undefined, message: ServerMessage) => post(socket, message);

function parse(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Carries one socket of an assist session. The first message must be a hello with a valid ticket.
 * After that the agent's commands reach the device only once the user granted control, and the
 * device's screen reaches the agent unparsed, as it came, so a busy screen costs one copy.
 */
export function relaySocket(
  socket: AssistSocket,
  registry: AssistRegistry,
  options: { now: () => number; logger: Logger },
): void {
  let session: AssistSession | null = null;
  let role: AssistRole | null = null;
  let allowance: Allowance | null = null;
  let lagging = false;

  /**
   * Says why in a message before closing: a proxy - Render's among them - may drop the close frame,
   * and the other side would otherwise only learn of it when the connection times out.
   */
  const refuse = (code: number, error: string, message: string) => {
    tell(socket, { t: "error", code: error, message });
    socket.close(code, message);
  };

  const helloTimer = setTimeout(() => {
    if (!session) refuse(CLOSE.noHello, "no_hello", "hello expected");
  }, ASSIST_LIMITS.helloMs);

  socket.onClose(() => {
    clearTimeout(helloTimer);
    if (session && role) registry.left(session.id, role, socket);
  });

  socket.onMessage((data, bytes) => {
    if (!session || !role) {
      const hello = parseAssistHello(parse(data));
      if (!hello || bytes > 1024) {
        options.logger.info("assist socket refused", { reason: "no hello" });
        refuse(CLOSE.unauthorized, "unauthorized", "hello expected");
        return;
      }
      const joined = registry.join(hello.session, hello.role, hello.ticket, socket);
      if (!joined) {
        options.logger.info("assist socket refused", { reason: "ticket", role: hello.role });
        refuse(CLOSE.unauthorized, "unauthorized", "unknown session or ticket");
        return;
      }
      options.logger.info("assist joined", { session: joined.id, role: hello.role });
      clearTimeout(helloTimer);
      session = joined;
      role = hello.role;
      allowance = new Allowance(
        role === "agent"
          ? ASSIST_LIMITS.agentMessagesPerSecond
          : ASSIST_LIMITS.deviceMessagesPerSecond,
        options.now,
      );
      return;
    }

    const limit =
      role === "agent" ? ASSIST_LIMITS.agentMessageBytes : ASSIST_LIMITS.deviceMessageBytes;
    if (bytes > limit) {
      refuse(CLOSE.tooBig, "too_big", "message too large");
      return;
    }
    if (!allowance?.take()) {
      tell(socket, { t: "error", code: "rate", message: "Too many messages" });
      return;
    }
    if (role === "agent") fromAgent(session, data);
    else fromDevice(session, data);
  });

  function fromAgent(current: AssistSession, data: string): void {
    const message = parseAgentMessage(parse(data));
    if (!message) return;
    if (message.t === "end") {
      registry.end(current.id, "agent");
      return;
    }
    if (CONTROL_MESSAGES.has(message.t) && current.control !== "granted") {
      tell(socket, {
        t: "error",
        code: "no_control",
        message: "The user has not given control",
      });
      return;
    }
    post(current.sockets.device, message);
  }

  function fromDevice(current: AssistSession, data: string): void {
    const message = parseDeviceMessage(parse(data));
    if (!message) return;
    const agent = current.sockets.agent;
    switch (message.t) {
      case "events":
        if (!agent) return;
        if (agent.buffered > MAX_AGENT_BACKLOG) {
          if (!lagging) options.logger.warn("assist agent lagging", { session: current.id });
          lagging = true;
          return;
        }
        lagging = false;
        try {
          agent.send(data);
        } catch {
          return;
        }
        return;
      case "control":
        registry.setControl(current.id, message.state);
        post(agent, message);
        return;
      case "refused":
      case "viewport":
        post(agent, message);
        return;
      case "end":
        registry.end(current.id, message.reason);
        return;
    }
  }
}
