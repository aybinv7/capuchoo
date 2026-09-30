import type { ResolvedUpdate } from "@capuchoo/core";

/** Where an update came from: our own check, or the plugin's background download. */
export type UpdateSource = "server" | "plugin";

export type MergeResult =
  /** Nothing changes. */
  | { action: "ignore" }
  /** The same artefact: take the new facts, keep the local progress. */
  | { action: "merge"; update: ResolvedUpdate }
  /** A different artefact: local progress no longer applies. */
  | { action: "replace"; update: ResolvedUpdate };

/** Same kind, same version and, for a native binary, the same build number. */
export function isSameArtefact(a: ResolvedUpdate, b: ResolvedUpdate): boolean {
  if (a.kind !== b.kind || a.version !== b.version) return false;
  return a.kind !== "native" || a.versionCode === b.versionCode;
}

/** Whether a bundle with `bundle`'s checksum is the one `described` says it is. */
function bundleMatches(described: ResolvedUpdate, bundle: ResolvedUpdate): boolean {
  if (!described.checksum) return true;
  return bundle.checksum?.toLowerCase() === described.checksum.toLowerCase();
}

/**
 * How an incoming update lands on the one already on offer.
 *
 * The server is authoritative for everything it says about an artefact -
 * `required`, a fresh signed URL, the signature - but never swaps the artefact
 * while one is downloading or with the installer. The plugin only ever
 * contributes a downloaded bundle id: it cannot clear `required`, cannot
 * displace a native update, and cannot attach a bundle unless its checksum is
 * exactly the one the server described - a bundle the plugin fetched through
 * its own check is otherwise unbound to the signature this app verifies.
 */
export function mergeUpdate(input: {
  current: ResolvedUpdate | null;
  incoming: ResolvedUpdate;
  source: UpdateSource;
  busy: boolean;
}): MergeResult {
  const { current, incoming, source, busy } = input;

  if (current && isSameArtefact(current, incoming)) {
    if (source === "plugin") {
      if (!incoming.bundleId || !bundleMatches(current, incoming)) return { action: "ignore" };
      return { action: "merge", update: { ...current, bundleId: incoming.bundleId } };
    }
    const keepBundle = current.bundleId && !incoming.bundleId && bundleMatches(incoming, current);
    return {
      action: "merge",
      update: { ...incoming, ...(keepBundle ? { bundleId: current.bundleId } : {}) },
    };
  }

  if (busy) return { action: "ignore" };
  if (source === "plugin" && current?.kind === "native") return { action: "ignore" };

  if (source === "plugin") {
    return {
      action: "replace",
      update: { ...incoming, required: incoming.required || current?.required === true },
    };
  }

  return { action: "replace", update: incoming };
}
