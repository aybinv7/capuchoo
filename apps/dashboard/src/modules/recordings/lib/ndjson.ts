import type { RecordedEvent } from "@capuchoo/core";

/** One segment's lines; a damaged line is skipped, not fatal. */
export function parseSegment(text: string): RecordedEvent[] {
  const events: RecordedEvent[] = [];
  let start = 0;
  while (start < text.length) {
    let end = text.indexOf("\n", start);
    if (end < 0) end = text.length;
    if (end > start) {
      try {
        const event = JSON.parse(text.slice(start, end)) as RecordedEvent;
        if (event && typeof event.k === "string" && typeof event.t === "number") events.push(event);
      } catch {
        void 0;
      }
    }
    start = end + 1;
  }
  return events;
}
