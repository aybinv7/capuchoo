import type { Environment, Platform } from "@capuchoo/core";
import type { AppArtefacts, ChannelRecord, PointerMove } from "../services/wire.js";

export interface ReleaseRow {
  id: string;
  kind: "ota" | "native";
  version: string;
  versionCode: number | null;
  platform: Platform;
  flavour: Environment | null;
  signed: boolean;
  createdAt: string;
  /** Channels that have served it. */
  channels: string[];
  /** Whether the filtered channel serves it right now. */
  current: boolean;
}

/** Bundles and native builds as one list, newest first, optionally only what a channel has served. */
export function releaseRows(artefacts: AppArtefacts, channel?: ChannelRecord | null): ReleaseRow[] {
  const rows: ReleaseRow[] = [
    ...artefacts.bundles.map((row) => ({
      id: row.id,
      kind: "ota" as const,
      version: row.version_name,
      versionCode: null,
      platform: row.platform,
      flavour: row.flavour,
      signed: Boolean(row.signed),
      createdAt: row.created_at,
      channels: row.channels ?? [],
      current: channel?.current_bundle_id === row.id,
    })),
    ...artefacts.native_builds.map((row) => ({
      id: row.id,
      kind: "native" as const,
      version: row.version_name,
      versionCode: row.version_code,
      platform: row.platform,
      flavour: row.flavour,
      signed: Boolean(row.signed),
      createdAt: row.created_at,
      channels: row.channels ?? [],
      current: channel?.current_native_id === row.id,
    })),
  ];

  const filtered = channel
    ? rows.filter((row) => row.current || row.channels.includes(channel.name))
    : rows;

  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** One history row as a line: when, what, which version, who, why. */
export function describeMove(move: PointerMove): string {
  const version = move.version_name
    ? `${move.version_name}${move.version_code ? ` (build ${move.version_code})` : ""}`
    : "";
  const target = move.native_id ? "native" : move.bundle_id ? "ota" : "";
  return [
    move.created_at.replace("T", " ").slice(0, 19),
    move.action.padEnd(8),
    [target, version].filter(Boolean).join(" ").padEnd(26),
    move.actor_email ?? "",
    move.reason ? `- ${move.reason}` : "",
  ]
    .filter((part) => part !== "")
    .join("  ");
}
