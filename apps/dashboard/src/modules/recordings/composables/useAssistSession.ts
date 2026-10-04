import {
  parseSafeArea,
  type AgentMessage,
  type AssistAnchor,
  type SafeArea,
  type AssistControl,
  type AssistEndReason,
  type AssistKey,
} from "@capuchoo/core";
import { useEventListener } from "@vueuse/core";
import { onScopeDispose, ref, shallowRef } from "vue";
import { endAssist, startAssist } from "../services/assist.service";
import type {
  AssistNotice,
  AssistOutcome,
  AssistPhase,
  AssistSessionInfo,
} from "../types/assist.types";
import type { RecordingAsset } from "../types/recordings.types";

/** The agent's pointer is sent at most this often; the device draws it moving smoothly between. */
const POINTER_MS = 50;
const MAX_NOTICES = 30;
/** A recorder from before the viewport message never sends one; the screen starts without it. */
const VIEWPORT_WAIT_MS = 1500;
/** Errors the server sends just before closing; its close frame may never arrive through a proxy. */
const FATAL_ERRORS = new Set(["unauthorized", "no_hello", "too_big"]);

const END_MESSAGES: Record<AssistEndReason | "failed", string> = {
  agent: "You ended the session.",
  user: "The user stopped the session.",
  background: "The user left the app, which ends the session.",
  expired: "The user did not answer in time.",
  timeout: "The session reached its hour.",
  replaced: "Another assist session for this device replaced this one.",
  denied: "The user declined.",
  error: "The connection to the device was lost.",
  failed: "The session could not start.",
};

type ScreenListener = (events: unknown[]) => void;

/**
 * The agent's side of an assist session: it asks the server, joins with its ticket, and keeps the
 * socket. The screen goes to `onScreen`; control commands only go out once the user granted
 * control, and leaving the page ends the session so a phone is never left asked.
 */
export function useAssistSession(deviceUuid: string, onScreen: ScreenListener) {
  const phase = ref<AssistPhase>("starting");
  const info = shallowRef<AssistSessionInfo | null>(null);
  const assets = shallowRef<RecordingAsset[]>([]);
  const control = ref<AssistControl>("none");
  const outcome = shallowRef<AssistOutcome | null>(null);
  const notices = ref<AssistNotice[]>([]);
  /** The phone's safe-area insets, which the replay needs before it can match the phone's layout. */
  const safeArea = shallowRef<SafeArea | null>(null);
  const viewportKnown = ref(false);
  /** The user's last touch the phone stopped because the agent holds control. */
  const blocked = shallowRef<{ x: number; y: number; at: number } | null>(null);
  let viewportTimer: ReturnType<typeof setTimeout> | null = null;
  let socket: WebSocket | null = null;
  let noticeId = 0;
  let lastPointer = 0;
  let pointerTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingPointer: AgentMessage | null = null;
  let lastBlockedNote = 0;

  /**
   * Sends the pointer at most every `POINTER_MS`. A move inside that window is held and sent when
   * it ends, so the phone always ends on the point the agent stopped at.
   */
  function sendPointer(message: AgentMessage) {
    const now = performance.now();
    const wait = POINTER_MS - (now - lastPointer);
    if (wait <= 0) {
      lastPointer = now;
      send(message);
      return;
    }
    pendingPointer = message;
    pointerTimer ??= setTimeout(() => {
      pointerTimer = null;
      const held = pendingPointer;
      pendingPointer = null;
      if (!held) return;
      lastPointer = performance.now();
      send(held);
    }, wait);
  }

  function dropPointer() {
    if (pointerTimer) clearTimeout(pointerTimer);
    pointerTimer = null;
    pendingPointer = null;
  }

  function note(tone: AssistNotice["tone"], text: string) {
    notices.value = [{ id: ++noticeId, at: Date.now(), tone, text }, ...notices.value].slice(
      0,
      MAX_NOTICES,
    );
  }

  function finish(reason: AssistEndReason | "failed", message = END_MESSAGES[reason]) {
    if (phase.value === "ended") return;
    phase.value = "ended";
    control.value = "none";
    dropPointer();
    if (viewportTimer) clearTimeout(viewportTimer);
    outcome.value = { reason, message };
    const open = socket;
    socket = null;
    open?.close(1000, "done");
  }

  function send(message: AgentMessage) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function onMessage(data: string) {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }
    switch (message.t) {
      case "events":
        if (Array.isArray(message.events)) onScreen(message.events);
        return;
      case "ready":
        if (message.peer) phase.value = "live";
        return;
      case "peer":
        if (message.present) {
          phase.value = "live";
          note("info", "The user accepted. You see their screen.");
          viewportTimer ??= setTimeout(() => (viewportKnown.value = true), VIEWPORT_WAIT_MS);
        }
        return;
      case "viewport": {
        const insets = parseSafeArea(message.safeArea);
        if (insets) safeArea.value = insets;
        viewportKnown.value = true;
        return;
      }
      case "control": {
        const state = message.state as AssistControl;
        control.value = state;
        if (state === "granted") note("info", "The user gave you control.");
        if (state === "denied") note("warning", "The user kept control.");
        if (state === "none") note("info", "Control is back with the user.");
        return;
      }
      case "refused":
        note("warning", `${String(message.action)} refused: ${String(message.reason)}`);
        return;
      case "blocked": {
        if (typeof message.x !== "number" || typeof message.y !== "number") return;
        const at = Date.now();
        blocked.value = { x: message.x, y: message.y, at };
        if (at - lastBlockedNote > 5000) {
          lastBlockedNote = at;
          note(
            "info",
            "The user tried to touch the screen; it stays yours until you give it back.",
          );
        }
        return;
      }
      case "error":
        if (message.code === "no_control") note("warning", "The user has not given control.");
        else if (message.code === "rate") note("warning", "Slow down: too many commands.");
        else if (FATAL_ERRORS.has(String(message.code))) {
          finish("failed", "The server refused this session; ask again.");
        }
        return;
      case "end":
        finish((message.reason as AssistEndReason) ?? "error");
        return;
    }
  }

  async function start() {
    try {
      const started = await startAssist(deviceUuid);
      info.value = started.session;
      assets.value = started.assets;
      phase.value = "waiting";
      const open = new WebSocket(started.socket_url);
      socket = open;
      open.addEventListener("open", () =>
        open.send(
          JSON.stringify({
            t: "hello",
            session: started.session.id,
            role: "agent",
            ticket: started.ticket,
          }),
        ),
      );
      open.addEventListener("message", (event) => onMessage(String(event.data)));
      open.addEventListener("close", () => {
        if (socket === open) finish("error");
      });
    } catch (error) {
      finish("failed", error instanceof Error ? error.message : END_MESSAGES.failed);
    }
  }

  function end() {
    if (phase.value === "ended") return;
    send({ t: "end" });
    const id = info.value?.id;
    finish("agent");
    if (id) void endAssist(id).catch(() => undefined);
  }

  useEventListener(window, "pagehide", end);
  onScopeDispose(end);
  void start();

  return {
    phase,
    info,
    assets,
    safeArea,
    viewportKnown,
    blocked,
    control,
    outcome,
    notices,
    end,
    requestControl: () => send({ t: "control" }),
    releaseControl: () => send({ t: "release" }),
    pointer(x: number, y: number, anchor?: AssistAnchor | null) {
      sendPointer(anchor ? { t: "pointer", x, y, anchor } : { t: "pointer", x, y });
    },
    pointerOff() {
      dropPointer();
      send({ t: "pointer-off" });
    },
    tap(x: number, y: number, anchor?: AssistAnchor | null) {
      dropPointer();
      send(anchor ? { t: "tap", x, y, anchor } : { t: "tap", x, y });
    },
    scroll: (x: number, y: number, dx: number, dy: number, anchor?: AssistAnchor | null) =>
      send(anchor ? { t: "scroll", x, y, dx, dy, anchor } : { t: "scroll", x, y, dx, dy }),
    type: (text: string) => send({ t: "type", text }),
    key: (key: AssistKey) => send({ t: "key", key }),
  };
}

export type AssistSessionHandle = ReturnType<typeof useAssistSession>;
