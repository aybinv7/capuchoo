import { parseSafeArea, type SafeArea } from "@capuchoo/core";
import { onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { startWatch } from "../services/assist.service";

export type LiveWatchState = "off" | "connecting" | "waiting" | "streaming";

/** Waits between attempts to reconnect, longest last. */
const RETRY_MS = [1000, 2000, 5000, 10_000];

/**
 * The screen of a live device straight from its socket, a fraction of a second behind the phone,
 * instead of after its next segment is uploaded and fetched. Reconnects while `enabled` holds;
 * the segments carry on regardless and fill in anything the socket missed.
 */
export function useLiveWatch(input: {
  deviceUuid: Ref<string | null>;
  enabled: Ref<boolean>;
  onEvents: (events: unknown[]) => void;
}) {
  const state = ref<LiveWatchState>("off");
  const safeArea = shallowRef<SafeArea | null>(null);
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let generation = 0;

  function close() {
    generation++;
    if (retry) clearTimeout(retry);
    retry = null;
    const open = socket;
    socket = null;
    if (open?.readyState === WebSocket.OPEN) open.send(JSON.stringify({ t: "end" }));
    open?.close(1000, "done");
    state.value = "off";
  }

  function scheduleRetry(run: number) {
    if (run !== generation || !input.enabled.value) return;
    state.value = "connecting";
    const delay = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]!;
    attempt++;
    retry = setTimeout(() => void connect(run), delay);
  }

  function onMessage(data: string) {
    let message: {
      t?: unknown;
      events?: unknown;
      safeArea?: unknown;
      device?: unknown;
      present?: unknown;
    };
    try {
      message = JSON.parse(data) as typeof message;
    } catch {
      return;
    }
    switch (message.t) {
      case "events":
        if (Array.isArray(message.events)) {
          state.value = "streaming";
          attempt = 0;
          input.onEvents(message.events);
        }
        return;
      case "viewport": {
        const insets = parseSafeArea(message.safeArea);
        if (insets) safeArea.value = insets;
        return;
      }
      case "ready":
        state.value = message.device ? "streaming" : "waiting";
        return;
      case "device":
        state.value = message.present ? "streaming" : "waiting";
        return;
    }
  }

  async function connect(run: number) {
    const device = input.deviceUuid.value;
    if (run !== generation || !device || !input.enabled.value) return;
    state.value = "connecting";
    let ticket: { room: string; ticket: string; socket_url: string };
    try {
      ticket = await startWatch(device);
    } catch {
      scheduleRetry(run);
      return;
    }
    if (run !== generation) return;
    const open = new WebSocket(ticket.socket_url);
    socket = open;
    open.addEventListener("open", () =>
      open.send(
        JSON.stringify({ t: "hello", room: ticket.room, role: "viewer", ticket: ticket.ticket }),
      ),
    );
    open.addEventListener("message", (event) => onMessage(String(event.data)));
    open.addEventListener("close", () => {
      if (socket !== open) return;
      socket = null;
      scheduleRetry(run);
    });
  }

  watch(
    [input.enabled, input.deviceUuid],
    ([enabled, device]) => {
      close();
      attempt = 0;
      if (enabled && device) void connect(generation);
    },
    { immediate: true },
  );
  onScopeDispose(close);

  return { state, safeArea };
}
