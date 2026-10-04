/**
 * Assist: a support agent watches a device live and, with the user's consent, points at or drives
 * the app. The agent and the device each hold a WebSocket to the server, which relays between them
 * and refuses anything the user has not allowed. Coordinates are CSS pixels of the app's viewport.
 */

import { parseSafeArea, type SafeArea } from "./recording-wire.js";

export const ASSIST_LIMITS = {
  /** A request the device has not answered by then is dropped. */
  requestTtlMs: 90_000,
  /** The longest an assist session runs. */
  sessionMs: 60 * 60_000,
  /** The first message must be `hello` within this, or the socket is closed. */
  helloMs: 5_000,
  /** Largest message from the agent; it only sends small commands. */
  agentMessageBytes: 4 * 1024,
  /** Largest message from the device: a full snapshot of a busy screen. */
  deviceMessageBytes: 4 * 1024 * 1024,
  agentMessagesPerSecond: 40,
  deviceMessagesPerSecond: 60,
  /** Longest text the agent may type in one message. */
  typedText: 500,
} as const;

export const ASSIST_KEYS = ["Enter", "Backspace", "Tab", "Escape"] as const;
export type AssistKey = (typeof ASSIST_KEYS)[number];

export type AssistRole = "agent" | "device";

/** What the user allowed the agent to do. */
export type AssistControl = "none" | "asked" | "granted" | "denied";

export type AssistEndReason =
  | "agent"
  | "user"
  | "background"
  | "expired"
  | "timeout"
  | "replaced"
  | "denied"
  | "error";

/** The first message on either socket. */
export interface AssistHello {
  t: "hello";
  session: string;
  role: AssistRole;
  ticket: string;
}

/**
 * A point named by the element under it: the recording's id for that node, and where in its box
 * the point sits, from 0 to 1 on each axis. The dashboard lays the app out with its own fonts, so
 * the same coordinates can fall on a different element there; the element's id cannot.
 */
export interface AssistAnchor {
  id: number;
  fx: number;
  fy: number;
}

export type AgentMessage =
  | { t: "pointer"; x: number; y: number; anchor?: AssistAnchor }
  | { t: "pointer-off" }
  | { t: "control" }
  | { t: "release" }
  | { t: "tap"; x: number; y: number; anchor?: AssistAnchor }
  | { t: "scroll"; x: number; y: number; dx: number; dy: number; anchor?: AssistAnchor }
  | { t: "type"; text: string }
  | { t: "key"; key: AssistKey }
  | { t: "end" };

export type DeviceMessage =
  | { t: "events"; events: unknown[] }
  /** The device's safe-area insets, sent before the screen and whenever they change. */
  | { t: "viewport"; safeArea: SafeArea }
  | { t: "control"; state: AssistControl }
  | { t: "refused"; action: string; reason: string }
  /** The user touched the app while the agent held control, and the touch was stopped. */
  | { t: "blocked"; x: number; y: number }
  | { t: "end"; reason: AssistEndReason };

/** What the server itself tells either side. */
export type ServerMessage =
  | { t: "ready"; peer: boolean; control: AssistControl }
  | { t: "peer"; present: boolean }
  | { t: "end"; reason: AssistEndReason }
  | { t: "error"; code: string; message: string };

/** Agent messages that act on the app, and so need the user's grant. */
export const CONTROL_MESSAGES = new Set<AgentMessage["t"]>(["tap", "scroll", "type", "key"]);

/** What the device's policy answer carries while an agent waits for it. */
export interface AssistInvite {
  session: string;
  ticket: string;
  /** How the agent is shown to the user. */
  agent: string;
  /** Wall-clock milliseconds after which the invite is void. */
  expiresAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const coordinate = (value: unknown): value is number =>
  finite(value) && value >= -10_000 && value <= 100_000;

const unit = (value: unknown): number | null =>
  finite(value) ? Math.max(0, Math.min(1, value)) : null;

export function parseAssistAnchor(raw: unknown): AssistAnchor | null {
  if (!isRecord(raw) || !Number.isInteger(raw.id) || (raw.id as number) < 1) return null;
  const fx = unit(raw.fx);
  const fy = unit(raw.fy);
  return fx === null || fy === null ? null : { id: raw.id as number, fx, fy };
}

const withAnchor = <T extends object>(message: T, raw: Record<string, unknown>) => {
  const anchor = parseAssistAnchor(raw.anchor);
  return anchor ? { ...message, anchor } : message;
};

export function parseAssistHello(raw: unknown): AssistHello | null {
  if (!isRecord(raw) || raw.t !== "hello") return null;
  if (typeof raw.session !== "string" || typeof raw.ticket !== "string") return null;
  if (raw.role !== "agent" && raw.role !== "device") return null;
  return { t: "hello", session: raw.session, role: raw.role, ticket: raw.ticket };
}

/** An agent message, validated field by field; anything else is null and is dropped. */
export function parseAgentMessage(raw: unknown): AgentMessage | null {
  if (!isRecord(raw) || typeof raw.t !== "string") return null;
  switch (raw.t) {
    case "pointer":
    case "tap":
      return coordinate(raw.x) && coordinate(raw.y)
        ? withAnchor({ t: raw.t, x: raw.x, y: raw.y }, raw)
        : null;
    case "scroll":
      return coordinate(raw.x) && coordinate(raw.y) && finite(raw.dx) && finite(raw.dy)
        ? withAnchor(
            {
              t: "scroll" as const,
              x: raw.x,
              y: raw.y,
              dx: Math.max(-5000, Math.min(5000, raw.dx)),
              dy: Math.max(-5000, Math.min(5000, raw.dy)),
            },
            raw,
          )
        : null;
    case "type":
      return typeof raw.text === "string" && raw.text.length <= ASSIST_LIMITS.typedText
        ? { t: "type", text: raw.text }
        : null;
    case "key":
      return (ASSIST_KEYS as readonly unknown[]).includes(raw.key)
        ? { t: "key", key: raw.key as AssistKey }
        : null;
    case "pointer-off":
    case "control":
    case "release":
    case "end":
      return { t: raw.t };
    default:
      return null;
  }
}

const CONTROL_STATES = new Set<AssistControl>(["none", "asked", "granted", "denied"]);
const END_REASONS = new Set<AssistEndReason>([
  "agent",
  "user",
  "background",
  "expired",
  "timeout",
  "replaced",
  "denied",
  "error",
]);

export function parseDeviceMessage(raw: unknown): DeviceMessage | null {
  if (!isRecord(raw) || typeof raw.t !== "string") return null;
  switch (raw.t) {
    case "events":
      return Array.isArray(raw.events) ? { t: "events", events: raw.events } : null;
    case "viewport": {
      const safeArea = parseSafeArea(raw.safeArea);
      return safeArea ? { t: "viewport", safeArea } : null;
    }
    case "control":
      return CONTROL_STATES.has(raw.state as AssistControl)
        ? { t: "control", state: raw.state as AssistControl }
        : null;
    case "refused":
      return typeof raw.action === "string" && typeof raw.reason === "string"
        ? { t: "refused", action: raw.action.slice(0, 40), reason: raw.reason.slice(0, 200) }
        : null;
    case "blocked":
      return coordinate(raw.x) && coordinate(raw.y) ? { t: "blocked", x: raw.x, y: raw.y } : null;
    case "end":
      return END_REASONS.has(raw.reason as AssistEndReason)
        ? { t: "end", reason: raw.reason as AssistEndReason }
        : null;
    default:
      return null;
  }
}

export function parseAssistInvite(raw: unknown): AssistInvite | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.session !== "string" || typeof raw.ticket !== "string") return null;
  if (typeof raw.agent !== "string" || !finite(raw.expiresAt)) return null;
  return {
    session: raw.session,
    ticket: raw.ticket,
    agent: raw.agent.slice(0, 80),
    expiresAt: raw.expiresAt,
  };
}
