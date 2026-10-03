import {
  type AgentMessage,
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
  let socket: WebSocket | null = null;
  let noticeId = 0;
  let lastPointer = 0;

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
        }
        return;
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
      case "error":
        if (message.code === "no_control") note("warning", "The user has not given control.");
        else if (message.code === "rate") note("warning", "Slow down: too many commands.");
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
    control,
    outcome,
    notices,
    end,
    requestControl: () => send({ t: "control" }),
    releaseControl: () => send({ t: "release" }),
    pointer(x: number, y: number) {
      const now = performance.now();
      if (now - lastPointer < POINTER_MS) return;
      lastPointer = now;
      send({ t: "pointer", x, y });
    },
    pointerOff: () => send({ t: "pointer-off" }),
    tap: (x: number, y: number) => send({ t: "tap", x, y }),
    scroll: (x: number, y: number, dx: number, dy: number) => send({ t: "scroll", x, y, dx, dy }),
    type: (text: string) => send({ t: "type", text }),
    key: (key: AssistKey) => send({ t: "key", key }),
  };
}

export type AssistSessionHandle = ReturnType<typeof useAssistSession>;
