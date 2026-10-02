import type { Channel, ReleaseCatalog } from "@/shared/types/release";

export type AlignmentState = "current" | "different" | "unknown";

export interface Alignment {
  state: AlignmentState;
  /** What the channel serves now, `1.4.2` or `1.4.2 (42)`. */
  served: string | null;
}

const UNKNOWN: Alignment = Object.freeze({ state: "unknown", served: null });

/** Whether the device runs the bundle its channel points at now. */
export function otaAlignment(
  running: string | null,
  channel: Channel | null,
  catalog: ReleaseCatalog,
): Alignment {
  const bundle = channel?.current_bundle_id
    ? catalog.bundles.find((entry) => entry.id === channel.current_bundle_id)
    : undefined;
  if (!bundle) return UNKNOWN;
  if (!running) return { state: "unknown", served: bundle.version_name };
  return {
    state: running === bundle.version_name ? "current" : "different",
    served: bundle.version_name,
  };
}

/** Whether the device runs the native build its channel points at now, by version code. */
export function nativeAlignment(
  versionCode: number | null,
  channel: Channel | null,
  catalog: ReleaseCatalog,
): Alignment {
  const build = channel?.current_native_id
    ? catalog.natives.find((entry) => entry.id === channel.current_native_id)
    : undefined;
  if (!build) return UNKNOWN;
  const served = `${build.version_name} (${build.version_code})`;
  if (versionCode === null) return { state: "unknown", served };
  return { state: versionCode === build.version_code ? "current" : "different", served };
}
