import type { PluginListenerHandle } from "@capacitor/core";
import { shallowRef } from "vue";
import type { ActivityTable } from "@/shared/database/schema";
import { CapuchooDevice, hasDevice } from "@/shared/native/device";
import { credentials } from "@/shared/session/session";
import { syncApp } from "./sync";

/** Server events that change what a screen shows; `device` and `build` traffic is not watched. */
const WATCHED = new Set(["artefact", "channel"]);
const SETTLE_MS = 600;

export type LiveState = "off" | "connecting" | "live" | "retrying";

export const liveState = shallowRef<LiveState>("off");

let listeners: PluginListenerHandle[] = [];
let open = new Set<string>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const states = new Map<string, "open" | "closed" | "retrying">();

function summarise(): void {
  if (open.size === 0) return void (liveState.value = "off");
  const values = [...states.values()];
  liveState.value = values.some((state) => state === "open")
    ? "live"
    : values.some((state) => state === "retrying")
      ? "retrying"
      : "connecting";
}

/**
 * One authenticated event stream per app, held natively: `GET /api/apps/:id/stream` is SSE behind a
 * Bearer token, which EventSource cannot send. A burst of events - an upload announces the build
 * and then the channel it activated - settles into one sync of that app.
 */
export async function startLive(appIds: string[], onActivity: (rows: ActivityTable[]) => void): Promise<void> {
  if (!hasDevice()) return;
  await stopLive();
  const c = credentials();

  listeners = await Promise.all([
    CapuchooDevice.addListener("streamMessage", ({ key, event }) => {
      if (!WATCHED.has(event)) return;
      clearTimeout(pending.get(key));
      pending.set(
        key,
        setTimeout(() => {
          pending.delete(key);
          syncApp(key)
            .then((rows) => rows.length && onActivity(rows))
            .catch(() => undefined);
        }, SETTLE_MS),
      );
    }),
    CapuchooDevice.addListener("streamState", ({ key, state }) => {
      states.set(key, state);
      summarise();
    }),
  ]);

  open = new Set(appIds);
  liveState.value = appIds.length ? "connecting" : "off";
  await Promise.all(
    appIds.map((appId) =>
      CapuchooDevice.openStream({
        key: appId,
        url: `${c.endpoint.replace(/\/+$/, "")}/api/apps/${appId}/stream`,
        token: c.token,
      }),
    ),
  );
}

export async function stopLive(): Promise<void> {
  if (!hasDevice()) return;
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
  await Promise.all([...open].map((key) => CapuchooDevice.closeStream({ key }).catch(() => undefined)));
  await Promise.all(listeners.map((listener) => listener.remove()));
  listeners = [];
  open = new Set();
  states.clear();
  liveState.value = "off";
}
