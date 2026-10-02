import { http } from "../api/http";
import type { LiveTransport, TransportHandlers } from "./transport";

const WAIT_S = 25;

interface PollPage {
  cursor: string;
  reset: boolean;
  events: Array<{ type: string; data: unknown }>;
}

/**
 * The app's events as a long poll, for a path where a proxy buffers streams. The cursor survives
 * reconnects through `cursorRef`, so a dropped request loses nothing the server still holds.
 */
export function openPollTransport(
  appId: string,
  cursorRef: { value: string | null },
  on: TransportHandlers,
): LiveTransport {
  const controller = new AbortController();
  const path = `/apps/${encodeURIComponent(appId)}/poll`;

  async function run() {
    let first = true;
    while (!controller.signal.aborted) {
      const page = await http.get<PollPage>(
        path,
        cursorRef.value === null ? {} : { after: cursorRef.value, wait: first ? 0 : WAIT_S },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      on.alive();
      if (first) on.ready(cursorRef.value === null ? false : page.reset);
      else if (page.reset) on.ready(true);
      cursorRef.value = page.cursor;
      first = false;
      for (const event of page.events) on.event(event.type, event.data);
    }
  }

  run().catch(() => {
    if (!controller.signal.aborted) on.failed();
  });

  return { close: () => controller.abort() };
}
