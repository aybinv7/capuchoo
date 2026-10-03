import { randomUUID } from "node:crypto";
import {
  ASSIST_LIMITS,
  type AssistControl,
  type AssistEndReason,
  type AssistInvite,
  type AssistRole,
  type ServerMessage,
} from "@capuchoo/core";
import { CLOSE, type AssistSocket } from "./socket";
import { newTicket, ticketMatches } from "./tickets";

export interface AssistAgent {
  userId: string | null;
  apiKeyId: string | null;
  /** How the user sees the agent named in the consent prompt. */
  name: string;
}

export interface AssistSession {
  id: string;
  appId: string;
  organizationId: string | null;
  deviceUuid: string;
  /** The id the device reports itself by, which its policy request carries. */
  deviceId: string;
  /** The bundle the device runs, whose stylesheets and images the agent's view needs. */
  versionName: string | null;
  agent: AssistAgent;
  status: "waiting" | "active" | "ended";
  control: AssistControl;
  createdAt: number;
  /** Until the device joins: when the invite lapses. */
  inviteExpiresAt: number;
  endsAt: number;
  sockets: Partial<Record<AssistRole, AssistSocket>>;
}

interface Secrets {
  agentTicket: Buffer;
  deviceTicket: Buffer;
  /** Kept in the clear only until the device joins: the policy answer hands it over. */
  devicePlain: string | null;
  used: Set<AssistRole>;
  timers: Array<ReturnType<typeof setTimeout>>;
}

export interface AssistAuditEntry {
  session: AssistSession;
  action: "assist.request" | "assist.accept" | "assist.control" | "assist.end";
  details: Record<string, unknown>;
}

export interface RegistryHooks {
  now: () => number;
  /** Wakes the device's held policy request so it sees the invite at once. */
  invite: (appId: string, deviceId: string) => void;
  audit: (entry: AssistAuditEntry) => void;
}

/** Public view of a session, for the dashboard. */
export function describeSession(session: AssistSession) {
  return {
    id: session.id,
    app_id: session.appId,
    device_uuid: session.deviceUuid,
    status: session.status,
    control: session.control,
    agent: session.agent.name,
    device_connected: Boolean(session.sockets.device),
    created_at: new Date(session.createdAt).toISOString(),
    invite_expires_at: new Date(session.inviteExpiresAt).toISOString(),
    ends_at: new Date(session.endsAt).toISOString(),
  };
}

const send = (socket: AssistSocket | undefined, message: ServerMessage) => {
  try {
    socket?.send(JSON.stringify(message));
  } catch {
    return;
  }
};

/**
 * The open assist sessions of this process, like the event hub: one per device at a time. A
 * session holds a ticket for each side, hashed; the device's travels in the clear only inside its
 * own policy answer, until it joins. Everything the user decides is audited.
 */
export class AssistRegistry {
  private readonly sessions = new Map<string, AssistSession>();
  private readonly secrets = new Map<string, Secrets>();
  private readonly byDevice = new Map<string, string>();

  constructor(private readonly hooks: RegistryHooks) {}

  get(id: string): AssistSession | null {
    return this.sessions.get(id) ?? null;
  }

  /** Opens a session for a device, ending any it already had, and returns the agent's ticket. */
  request(input: {
    appId: string;
    organizationId: string | null;
    deviceUuid: string;
    deviceId: string;
    versionName: string | null;
    agent: AssistAgent;
  }): { session: AssistSession; agentTicket: string } {
    const deviceKey = `${input.appId}:${input.deviceId}`;
    const previous = this.byDevice.get(deviceKey);
    if (previous) this.end(previous, "replaced");

    const now = this.hooks.now();
    const agentTicket = newTicket();
    const deviceTicket = newTicket();
    const session: AssistSession = {
      id: randomUUID(),
      ...input,
      status: "waiting",
      control: "none",
      createdAt: now,
      inviteExpiresAt: now + ASSIST_LIMITS.requestTtlMs,
      endsAt: now + ASSIST_LIMITS.sessionMs,
      sockets: {},
    };
    const secrets: Secrets = {
      agentTicket: agentTicket.hash,
      deviceTicket: deviceTicket.hash,
      devicePlain: deviceTicket.plain,
      used: new Set(),
      timers: [],
    };
    this.sessions.set(session.id, session);
    this.secrets.set(session.id, secrets);
    this.byDevice.set(deviceKey, session.id);
    secrets.timers.push(
      setTimeout(() => {
        if (this.get(session.id)?.status === "waiting") this.end(session.id, "expired");
      }, ASSIST_LIMITS.requestTtlMs),
      setTimeout(() => this.end(session.id, "timeout"), ASSIST_LIMITS.sessionMs),
    );
    this.hooks.audit({
      session,
      action: "assist.request",
      details: { agent: input.agent.name },
    });
    this.hooks.invite(input.appId, input.deviceId);
    return { session, agentTicket: agentTicket.plain };
  }

  /** The invite a device's policy answer carries while an agent waits for it. */
  inviteFor(appId: string, deviceId: string): AssistInvite | null {
    const id = this.byDevice.get(`${appId}:${deviceId}`);
    const session = id ? this.sessions.get(id) : undefined;
    const plain = id ? this.secrets.get(id)?.devicePlain : null;
    if (!session || !plain || session.status !== "waiting") return null;
    if (session.inviteExpiresAt <= this.hooks.now()) return null;
    return {
      session: session.id,
      ticket: plain,
      agent: session.agent.name,
      expiresAt: session.inviteExpiresAt,
    };
  }

  /** Lets a socket in as `role` if its ticket is right and unused; null otherwise. */
  join(id: string, role: AssistRole, ticket: string, socket: AssistSocket): AssistSession | null {
    const session = this.sessions.get(id);
    const secrets = this.secrets.get(id);
    if (!session || !secrets || session.status === "ended") return null;
    if (secrets.used.has(role)) return null;
    const hash = role === "agent" ? secrets.agentTicket : secrets.deviceTicket;
    if (!ticketMatches(ticket, hash)) return null;
    if (role === "device" && session.inviteExpiresAt <= this.hooks.now()) return null;

    secrets.used.add(role);
    session.sockets[role] = socket;
    if (role === "device") {
      secrets.devicePlain = null;
      session.status = "active";
      this.hooks.audit({ session, action: "assist.accept", details: {} });
    }
    const other = role === "agent" ? "device" : "agent";
    send(socket, { t: "ready", peer: Boolean(session.sockets[other]), control: session.control });
    send(session.sockets[other], { t: "peer", present: true });
    return session;
  }

  /** What the user allowed, as their device reports it. */
  setControl(id: string, control: AssistControl): void {
    const session = this.sessions.get(id);
    if (!session || session.control === control) return;
    session.control = control;
    this.hooks.audit({ session, action: "assist.control", details: { control } });
  }

  /** The user said no before connecting: the device answers its invite with its ticket. */
  decline(id: string, ticket: string): boolean {
    const session = this.sessions.get(id);
    const secrets = this.secrets.get(id);
    if (!session || !secrets || session.status !== "waiting") return false;
    if (!ticketMatches(ticket, secrets.deviceTicket)) return false;
    this.end(id, "denied");
    return true;
  }

  /** A side's socket closed: the session ends, since neither side can rejoin with a used ticket. */
  left(id: string, role: AssistRole, socket: AssistSocket): void {
    const session = this.sessions.get(id);
    if (!session || session.sockets[role] !== socket) return;
    this.end(id, role === "agent" ? "agent" : "user");
  }

  end(id: string, reason: AssistEndReason): void {
    const session = this.sessions.get(id);
    const secrets = this.secrets.get(id);
    if (!session || !secrets || session.status === "ended") return;
    const wasActive = session.status === "active";
    session.status = "ended";
    for (const timer of secrets.timers) clearTimeout(timer);
    for (const socket of Object.values(session.sockets)) {
      send(socket, { t: "end", reason });
      try {
        socket?.close(CLOSE.ended, reason);
      } catch {
        continue;
      }
    }
    session.sockets = {};
    this.sessions.delete(id);
    this.secrets.delete(id);
    const deviceKey = `${session.appId}:${session.deviceId}`;
    if (this.byDevice.get(deviceKey) === id) this.byDevice.delete(deviceKey);
    this.hooks.audit({
      session,
      action: "assist.end",
      details: {
        reason,
        connected: wasActive,
        control: session.control,
        seconds: Math.round((this.hooks.now() - session.createdAt) / 1000),
      },
    });
  }

  /** Ends every session, for shutdown. */
  closeAll(): void {
    for (const id of [...this.sessions.keys()]) this.end(id, "timeout");
  }

  get size(): number {
    return this.sessions.size;
  }
}
