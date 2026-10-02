import { compareVersions } from "@capuchoo/core";
import type { VersionShare } from "../types/channel-insights.types";

/** The version the updater reports before any bundle is applied. */
export const BUILTIN_VERSION = "builtin";
/** The server's row for every version past the first six. */
export const OTHER_VERSION = "other";

export type MixTone = "current" | "ahead" | "behind" | "builtin" | "other";

export interface MixSegment {
  version: string;
  label: string;
  devices: number;
  /** Of the devices in the mix, 0 to 1. */
  share: number;
  tone: MixTone;
  /** CSS colour, from the design tokens. */
  color: string;
  hatched: boolean;
}

const RANK: Record<MixTone, number> = { current: 0, ahead: 1, behind: 2, builtin: 3, other: 4 };
const FADE_FROM = 62;
const FADE_STEP = 10;
const FADE_FLOOR = 22;

const muted = (percent: number) =>
  `color-mix(in oklch, var(--muted-foreground) ${percent}%, transparent)`;

function toneOf(row: VersionShare, current: string | null): MixTone {
  if (row.version === OTHER_VERSION) return "other";
  if (row.version === BUILTIN_VERSION) return "builtin";
  if (row.current || row.version === current) return "current";
  return current && compareVersions(row.version, current) > 0 ? "ahead" : "behind";
}

function labelOf(version: string): string {
  if (version === BUILTIN_VERSION) return "built-in";
  return version === OTHER_VERSION ? "other versions" : version;
}

/**
 * The version mix as bar segments: the current version first in the primary colour, versions
 * ahead of it (left over by a rollback) next, then older ones newest first in fading greys,
 * built-in hatched and the long tail last. Empty rows are dropped.
 */
export function versionMix(rows: readonly VersionShare[], current: string | null): MixSegment[] {
  const kept = rows.filter((row) => row.devices > 0);
  const total = kept.reduce((sum, row) => sum + row.devices, 0);
  const ordered = kept
    .map((row) => ({ row, tone: toneOf(row, current) }))
    .sort((a, b) => RANK[a.tone] - RANK[b.tone] || compareVersions(b.row.version, a.row.version));
  let faded = 0;
  return ordered.map(({ row, tone }) => {
    let color = "var(--border)";
    if (tone === "current") color = "var(--primary)";
    else if (tone === "ahead") color = "var(--info)";
    else if (tone === "builtin") color = muted(45);
    else if (tone === "behind") {
      color = muted(Math.max(FADE_FLOOR, FADE_FROM - faded * FADE_STEP));
      faded += 1;
    }
    return {
      version: row.version,
      label: labelOf(row.version),
      devices: row.devices,
      share: total > 0 ? row.devices / total : 0,
      tone,
      color,
      hatched: tone === "builtin",
    };
  });
}

/** The fill of a segment or its legend swatch: flat, or hatched for built-in. */
export function segmentFill(segment: Pick<MixSegment, "color" | "hatched">): string {
  return segment.hatched
    ? `repeating-linear-gradient(135deg, ${segment.color} 0 2px, transparent 2px 5px)`
    : segment.color;
}
