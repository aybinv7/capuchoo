import { useQueryClient } from "@tanstack/vue-query";
import { useEventListener } from "@vueuse/core";
import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from "vue";
import { API_BASE } from "../api/http";
import { queryKeys } from "../api/query-keys";
import { useLiveStore } from "../stores/live.store";
import { createCacheOpApplier } from "./apply-cache-ops";
import { reconnectDelay } from "./backoff";
import { reduceStreamEvent } from "./stream-reducer";

const EVENT_TYPES = [
  "ready",
  "ping",
  "build",
  "build_event",
  "build_job",
  "channel",
  "device",
  "artefact",
];
const SILENCE_LIMIT_MS = 60_000;
const SESSION_PROBE_AFTER = 3;

/**
 * Keeps one `EventSource` open on the app's stream and folds its events into the query cache. The
 * browser's own retry is replaced with capped, jittered backoff; a reconnect invalidates the app's
 * queries because events sent while disconnected are gone. Repeated failures re-check the session,
 * so an expired cookie ends in the sign-in page rather than a silent retry loop.
 */
export function useAppStream(appId: MaybeRefOrGetter<string | null | undefined>): void {
  const client = useQueryClient();
  const live = useLiveStore();
  const applier = createCacheOpApplier(client);

  let source: EventSource | null = null;
  let current: string | null = null;
  let attempt = 0;
  let hadSession = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  function closeSource() {
    clearTimeout(silenceTimer);
    source?.close();
    source = null;
  }

  function stop() {
    clearTimeout(retryTimer);
    closeSource();
    live.mark("idle");
  }

  function armSilenceWatch(id: string) {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => scheduleReconnect(id), SILENCE_LIMIT_MS);
  }

  function scheduleReconnect(id: string) {
    closeSource();
    clearTimeout(retryTimer);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      live.mark("offline");
      return;
    }
    const delay = reconnectDelay(attempt);
    attempt += 1;
    if (attempt >= SESSION_PROBE_AFTER) void client.invalidateQueries({ queryKey: queryKeys.me() });
    live.mark("reconnecting", Date.now() + delay);
    retryTimer = setTimeout(() => connect(id), delay);
  }

  function handle(id: string, type: string, event: MessageEvent<string>) {
    live.touch();
    armSilenceWatch(id);
    if (type === "ready") {
      if (hadSession) void client.invalidateQueries({ queryKey: queryKeys.app(id) });
      hadSession = true;
      attempt = 0;
      live.mark("live");
      return;
    }
    if (type === "ping") return;
    let data: unknown;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    applier.apply(reduceStreamEvent(id, { type, data }));
  }

  function connect(id: string) {
    closeSource();
    live.mark(attempt === 0 ? "connecting" : "reconnecting");
    const stream = new EventSource(`${API_BASE}/apps/${encodeURIComponent(id)}/stream`);
    source = stream;
    for (const type of EVENT_TYPES) {
      stream.addEventListener(type, (event) => handle(id, type, event as MessageEvent<string>));
    }
    stream.onerror = () => {
      if (source === stream) scheduleReconnect(id);
    };
    armSilenceWatch(id);
  }

  watch(
    () => toValue(appId) ?? null,
    (id) => {
      stop();
      current = id;
      attempt = 0;
      hadSession = false;
      if (id) connect(id);
    },
    { immediate: true },
  );

  useEventListener(window, "online", () => {
    if (current && !source) {
      attempt = 0;
      connect(current);
    }
  });
  useEventListener(window, "offline", () => {
    if (current) {
      closeSource();
      clearTimeout(retryTimer);
      live.mark("offline");
    }
  });

  onScopeDispose(() => {
    stop();
    applier.dispose();
  });
}
