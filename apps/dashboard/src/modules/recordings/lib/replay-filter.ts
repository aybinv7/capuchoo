const FULL_SNAPSHOT = 2;
const INCREMENTAL = 3;
const SOURCE_MEDIA = 7;

/**
 * Drops media events aimed at the document. Capacitor fires `pause` and `resume` on it when the app
 * leaves and returns to the foreground, older recorders recorded them as media events, and rrweb
 * throws replaying one. `documents` collects the document's node id from each full snapshot.
 */
export function keepReplayEvent(
  event: { type: number; data?: unknown },
  documents: Set<number>,
): boolean {
  const data = event.data as { node?: { id?: unknown }; source?: unknown; id?: unknown } | null;
  if (event.type === FULL_SNAPSHOT && typeof data?.node?.id === "number") {
    documents.add(data.node.id);
    return true;
  }
  return !(
    event.type === INCREMENTAL &&
    data?.source === SOURCE_MEDIA &&
    typeof data.id === "number" &&
    documents.has(data.id)
  );
}
