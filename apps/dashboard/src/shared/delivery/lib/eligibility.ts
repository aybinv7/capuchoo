import { canPoint, compareVersions, type PointerVerdict } from "@capuchoo/core";
import type {
  Artefact,
  Bundle,
  Channel,
  ChannelHistoryEntry,
  NativeBuild,
  ReleaseCatalog,
} from "../../types/release";

export type ArtefactKind = Artefact["kind"];

export interface ChannelCurrent {
  bundle: Bundle | null;
  native: NativeBuild | null;
}

export interface PointerPreview {
  verdict: PointerVerdict;
  from: Artefact | null;
  to: Artefact;
}

export interface PreviewInput {
  channel: Channel;
  artefact: Artefact;
  catalog: ReleaseCatalog;
  /** Artefact ids the base channel has served; only read for a client channel. */
  servedByBase?: ReadonlySet<string>;
  rollback?: boolean;
}

/** What the channel serves now, resolved against the catalog. */
export function channelCurrent(channel: Channel, catalog: ReleaseCatalog): ChannelCurrent {
  return {
    bundle: catalog.bundles.find((bundle) => bundle.id === channel.current_bundle_id) ?? null,
    native: catalog.natives.find((native) => native.id === channel.current_native_id) ?? null,
  };
}

/**
 * Ids a client channel's base has served: its current pointers and every pointer move in its
 * history. The server answers the same question from `channel_events`, so the preview agrees
 * whenever the history page covers the move.
 */
export function servedByBaseIds(
  base: Channel | undefined,
  history: readonly ChannelHistoryEntry[] = [],
): Set<string> {
  const ids = new Set<string>();
  if (!base) return ids;
  if (base.current_bundle_id) ids.add(base.current_bundle_id);
  if (base.current_native_id) ids.add(base.current_native_id);
  for (const entry of history) if (entry.to_id) ids.add(entry.to_id);
  return ids;
}

/**
 * The verdict `POST /api/channels/:id/point` would reach, from the same facts the server loads in
 * `evaluatePointer`. A preview only: the server's answer is final.
 */
export function previewPointer(input: PreviewInput): PointerPreview {
  const { channel, artefact, catalog } = input;
  const current = channelCurrent(channel, catalog);
  const from = artefact.kind === "ota" ? current.bundle : current.native;
  const verdict = canPoint({
    channel: {
      appId: channel.app_id,
      name: channel.name,
      environment: channel.environment,
      kind: channel.kind,
      iosEnabled: channel.ios_enabled,
      androidEnabled: channel.android_enabled,
      currentNativeCode: current.native?.version_code ?? null,
      currentBundleGate: current.bundle?.min_native_version ?? null,
      currentVersion: from
        ? {
            versionName: from.version_name,
            ...(from.kind === "native" ? { versionCode: from.version_code } : {}),
          }
        : null,
    },
    artefact: {
      appId: artefact.app_id,
      kind: artefact.kind,
      platform: artefact.platform,
      flavour: artefact.flavour,
      versionName: artefact.version_name,
      versionCode: artefact.kind === "native" ? artefact.version_code : null,
      minNativeVersion: artefact.kind === "ota" ? artefact.min_native_version : null,
    },
    servedByBase:
      channel.kind === "client" ? (input.servedByBase?.has(artefact.id) ?? false) : undefined,
    rollback: input.rollback ?? false,
  });
  return { verdict, from, to: artefact };
}

/** Newest first: native builds by build number, bundles by version. */
export function compareArtefactsDesc(a: Artefact, b: Artefact): number {
  if (a.kind === "native" && b.kind === "native") return b.version_code - a.version_code;
  return compareVersions(b.version_name, a.version_name);
}

export function artefactsOfKind(catalog: ReleaseCatalog, kind: ArtefactKind): Artefact[] {
  const list: Artefact[] = kind === "ota" ? catalog.bundles : catalog.natives;
  return [...list].sort(compareArtefactsDesc);
}

export interface Candidate {
  artefact: Artefact;
  preview: PointerPreview;
}

/**
 * Every artefact of a kind with its verdict for this channel, newest first. `same` verdicts for the
 * artefact already served are dropped: pointing at it again changes nothing.
 */
export function deliveryCandidates(
  channel: Channel,
  catalog: ReleaseCatalog,
  kind: ArtefactKind,
  options: { servedByBase?: ReadonlySet<string>; rollback?: boolean } = {},
): Candidate[] {
  const currentId = kind === "ota" ? channel.current_bundle_id : channel.current_native_id;
  return artefactsOfKind(catalog, kind)
    .filter((artefact) => artefact.id !== currentId)
    .map((artefact) => ({
      artefact,
      preview: previewPointer({ channel, artefact, catalog, ...options }),
    }));
}

/** Candidates the server would accept. For a rollback, only lower versions pass `canPoint`. */
export function acceptedCandidates(candidates: readonly Candidate[]): Candidate[] {
  return candidates.filter((candidate) => candidate.preview.verdict.ok);
}

/** Channels currently pointing at an artefact. */
export function channelsServing(artefactId: string, channels: readonly Channel[]): Channel[] {
  return channels.filter(
    (channel) =>
      channel.current_bundle_id === artefactId || channel.current_native_id === artefactId,
  );
}

/** Finds an artefact of either kind by id. */
export function findArtefact(catalog: ReleaseCatalog, id: string): Artefact | undefined {
  return (
    catalog.bundles.find((bundle) => bundle.id === id) ??
    catalog.natives.find((native) => native.id === id)
  );
}
