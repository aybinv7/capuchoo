import type { Environment } from "@capuchoo/core";
import type { AppArtefacts } from "../services/wire.js";

export interface PublishedQuery {
  kind: "ota" | "native";
  platform: string;
  flavour: Environment;
  version: string;
  versionCode: number;
}

export type PublishedState =
  | { kind: "published"; id: string }
  | { kind: "absent" }
  /** The server could not be asked, so whether the upload landed is not known. */
  | { kind: "unknown"; reason: string };

export interface RecoveryOptions {
  attempts?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** The artefact an upload would have created, if the server has it. */
export function findPublished(artefacts: AppArtefacts, query: PublishedQuery): string | null {
  if (query.kind === "ota") {
    const row = artefacts.bundles.find(
      (bundle) =>
        bundle.version_name === query.version &&
        bundle.platform === query.platform &&
        bundle.flavour === query.flavour,
    );
    return row?.id ?? null;
  }
  const row = artefacts.native_builds.find(
    (build) =>
      build.version_code === query.versionCode &&
      build.platform === query.platform &&
      build.flavour === query.flavour,
  );
  return row?.id ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * After an upload timed out, asks the server whether the artefact exists. It may still be
 * storing the body, so "absent" is only concluded after a few spaced attempts.
 */
export async function confirmAfterTimeout(
  list: () => Promise<AppArtefacts>,
  query: PublishedQuery,
  options: RecoveryOptions = {},
): Promise<PublishedState> {
  const attempts = options.attempts ?? 4;
  const wait = options.sleep ?? sleep;
  let lastError: unknown = null;
  let answered = false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await wait(options.intervalMs ?? 5_000);
    try {
      const id = findPublished(await list(), query);
      if (id) return { kind: "published", id };
      answered = true;
    } catch (error) {
      lastError = error;
    }
  }

  if (answered) return { kind: "absent" };
  return {
    kind: "unknown",
    reason: lastError instanceof Error ? lastError.message : String(lastError),
  };
}
