import { useQueryClient } from "@tanstack/vue-query";
import { useEventListener } from "@vueuse/core";
import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "../api/query-keys";
import { useLiveStore } from "../stores/live.store";
import { createCacheOpApplier } from "./apply-cache-ops";
import { reconnectDelay } from "./backoff";
import { openPollTransport } from "./poll-transport";
import { openSseTransport } from "./sse-transport";
import { reduceStreamEvent } from "./stream-reducer";
import type { LiveTransport } from "./transport";
import { preferredTransport, rememberTransport, type TransportKind } from "./transport-choice";

const SILENCE_LIMIT_MS = 60_000;
const SSE_READY_LIMIT_MS = 5_000;
const SESSION_PROBE_AFTER = 3;

/**
 * Keeps the app's live events flowing into the query cache. A stream is tried first; when no
 * `ready` arrives in time (a proxy buffering it) the tab switches to a long poll for the session.
 * The browser's own retry is replaced with capped, jittered backoff; when events may have been
 * missed the app's queries are invalidated. Repeated failures re-check the session, so an expired
 * cookie ends in the sign-in page rather than a silent retry loop.
 */
export function useAppStream(appId: MaybeRefOrGetter<string | null | undefined>): void {
  const client = useQueryClient();
  const live = useLiveStore();
  const applier = createCacheOpApplier(client);

  let transport: LiveTransport | null = null;
  let kind: TransportKind = preferredTransport();
  let current: string | null = null;
  let attempt = 0;
  let hadSession = false;
  const cursor: { value: string | null } = { value: null };
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;

  function closeTransport() {
    clearTimeout(silenceTimer);
    clearTimeout(readyTimer);
    transport?.close();
    transport = null;
  }

  function stop() {
    clearTimeout(retryTimer);
    closeTransport();
    live.mark("idle");
  }

  function armSilenceWatch(id: string) {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => scheduleReconnect(id), SILENCE_LIMIT_MS);
  }

  function scheduleReconnect(id: string) {
    closeTransport();
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

  function fallBackToPoll(id: string) {
    kind = "poll";
    rememberTransport("poll");
    closeTransport();
    connect(id);
  }

  function connect(id: string) {
    closeTransport();
    live.mark(attempt === 0 ? "connecting" : "reconnecting");
    const handlers = {
      ready(lostEvents: boolean) {
        clearTimeout(readyTimer);
        live.touch();
        armSilenceWatch(id);
        if (hadSession && lostEvents)
          void client.invalidateQueries({ queryKey: queryKeys.app(id) });
        hadSession = true;
        attempt = 0;
        live.mark("live");
      },
      event(type: string, data: unknown) {
        applier.apply(reduceStreamEvent(id, { type, data }));
      },
      alive() {
        live.touch();
        armSilenceWatch(id);
      },
      failed() {
        scheduleReconnect(id);
      },
    };
    if (kind === "poll") {
      transport = openPollTransport(id, cursor, handlers);
    } else {
      transport = openSseTransport(id, handlers);
      readyTimer = setTimeout(() => fallBackToPoll(id), SSE_READY_LIMIT_MS);
    }
    armSilenceWatch(id);
  }

  watch(
    () => toValue(appId) ?? null,
    (id) => {
      stop();
      current = id;
      attempt = 0;
      hadSession = false;
      cursor.value = null;
      if (id) connect(id);
    },
    { immediate: true },
  );

  useEventListener(window, "online", () => {
    if (current && !transport) {
      attempt = 0;
      connect(current);
    }
  });
  useEventListener(window, "offline", () => {
    if (current) {
      closeTransport();
      clearTimeout(retryTimer);
      live.mark("offline");
    }
  });

  onScopeDispose(() => {
    stop();
    applier.dispose();
  });
}
