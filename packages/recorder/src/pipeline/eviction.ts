import type { RecordingSegmentMeta } from "@capuchoo/core";

export interface BufferLimits {
  maxMs: number;
  maxBytes: number;
}

/**
 * Which buffered segments to drop. Segments are dropped a replay group at a time - from one full
 * snapshot to the next - so whatever survives still starts somewhere playback can begin. The newest
 * group always survives. With no full snapshot at all (replay off), every segment is its own group.
 */
export function segmentsToEvict(
  segments: readonly RecordingSegmentMeta[],
  limits: BufferLimits,
  now: number,
  sizeOf: (segment: RecordingSegmentMeta) => number,
): number[] {
  if (segments.length === 0) return [];
  const ordered = [...segments].sort((a, b) => a.seq - b.seq);
  const anchored = ordered.some((segment) => segment.fullSnapshot);

  const groups: RecordingSegmentMeta[][] = [];
  for (const segment of ordered) {
    const startsGroup = !anchored || segment.fullSnapshot || groups.length === 0;
    if (startsGroup) groups.push([segment]);
    else groups.at(-1)!.push(segment);
  }

  let kept = 0;
  let bytes = 0;
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index]!;
    const groupBytes = group.reduce((sum, segment) => sum + sizeOf(segment), 0);
    const groupEnd = Math.max(...group.map((segment) => segment.endedAt));
    const isNewest = index === groups.length - 1;
    if (!isNewest && (bytes + groupBytes > limits.maxBytes || now - groupEnd > limits.maxMs)) break;
    bytes += groupBytes;
    kept++;
  }

  return groups
    .slice(0, groups.length - kept)
    .flat()
    .map((segment) => segment.seq);
}
