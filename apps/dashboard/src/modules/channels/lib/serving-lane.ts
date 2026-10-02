import type { LaneStatus } from "@/shared/components/release-lane/types";
import type { Bundle, NativeBuild } from "@/shared/types/release";

/** The native node's line: its SDK floor, or that nothing is served. */
export function nativeStatus(native: NativeBuild | null): LaneStatus | null {
  if (!native) return { tone: "muted", text: "No native build yet" };
  return native.min_sdk !== null ? { tone: "muted", text: `min SDK ${native.min_sdk}` } : null;
}

/**
 * The OTA node's line: the native build it needs, flagged when the channel's own native build is
 * below it, so those devices never take the bundle.
 */
export function bundleStatus(bundle: Bundle | null, native: NativeBuild | null): LaneStatus {
  if (!bundle) return { tone: "muted", text: "No OTA bundle yet" };
  const floor = bundle.min_native_version;
  if (floor === null) return { tone: "muted", text: "any native build" };
  if (native && native.version_code < floor)
    return {
      tone: "warning",
      text: `needs native ≥ ${floor} · channel has ${native.version_code}`,
    };
  return { tone: "muted", text: `needs native ≥ ${floor}` };
}
