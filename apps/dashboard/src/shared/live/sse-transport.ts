import { API_BASE } from "../api/http";
import type { LiveTransport, TransportHandlers } from "./transport";

const EVENT_TYPES = [
  "build",
  "build_event",
  "build_job",
  "channel",
  "device",
  "artefact",
  "recording",
  "recorder_health",
];

/** The app's events over one `EventSource`. Every connect starts fresh, so `ready` says events were lost. */
export function openSseTransport(appId: string, on: TransportHandlers): LiveTransport {
  const source = new EventSource(`${API_BASE}/apps/${encodeURIComponent(appId)}/stream`);
  let closed = false;
  source.addEventListener("ready", () => on.ready(true));
  source.addEventListener("ping", () => on.alive());
  for (const type of EVENT_TYPES) {
    source.addEventListener(type, (message) => {
      on.alive();
      let data: unknown;
      try {
        data = JSON.parse((message as MessageEvent<string>).data);
      } catch {
        return;
      }
      on.event(type, data);
    });
  }
  source.onerror = () => {
    if (!closed) on.failed();
  };
  return {
    close() {
      closed = true;
      source.close();
    },
  };
}
