/**
 * Whether a bundle's native gate can be satisfied by the channel it is being
 * published to.
 *
 * `app_versions.min_update_version` says "a device needs at least this native
 * build before this web bundle may run on it". `decideUpdate` honours it: a
 * device below the line is answered `native-required` and offered the binary
 * instead of the bundle. That is the whole point - it is what stops an OTA
 * landing on a binary that lacks the plugin, permission or API the bundle now
 * depends on, and crashing on launch.
 *
 * The gate has one failure mode of its own, and it is silent. If the channel
 * has no native release satisfying the line, the server looks for the binary to
 * offer, finds none, and answers `native_update: null`. `resolveUpdate` reads
 * that as "no update at all", so the device is not crashed - it is frozen. It
 * will never take the bundle, it is never told why, and nothing on the
 * dashboard says so either. Every device on the channel stops updating and the
 * release still reads as published.
 *
 * So the check belongs at the moment the gate is written, where there is
 * someone to tell. Pure, because it is wanted in three places: the upload, the
 * promote, and the tests.
 */

/** A native gate as stored: a build number, or absent. */
export type NativeGate = string | number | null | undefined;

export interface NativeGateFacts {
  /** `min_update_version` on the bundle being published. */
  gate: NativeGate;
  /**
   * `version_code` of the native release the target channel currently serves,
   * or null when it serves none.
   */
  channelNativeCode: number | null;
  /** For the message only. */
  channelName: string;
}

export type NativeGateVerdict =
  | { ok: true; gate: number | null }
  | { ok: false; reason: "malformed"; problem: string }
  | { ok: false; reason: "unsatisfiable"; problem: string; gate: number; available: number | null };

/**
 * `min_update_version` as the decision reads it.
 *
 * Deliberately the same arithmetic as `minimumNativeVersion` in
 * update-decision.ts - `Number.parseInt`, compared against a device's
 * `version_code`. It is a build number despite the column's name, and a semver
 * string parses to 0, which that function treats as "no gate". Anything this
 * function calls malformed is a value that would silently disable the gate.
 */
function parseGate(gate: NativeGate): number | null {
  if (gate === null || gate === undefined || gate === "") return null;

  const parsed =
    typeof gate === "number"
      ? Number.isInteger(gate)
        ? gate
        : Number.NaN
      : /^[0-9]+$/.test(gate.trim())
        ? Number.parseInt(gate.trim(), 10)
        : Number.NaN;

  if (Number.isNaN(parsed)) return Number.NaN;

  // 0 is "no gate", not a gate every build satisfies. Said here because
  // `minimumNativeVersion` says it: it returns 0 for anything <= 0 and the
  // decision branches on `minimum > 0`. Reporting 0 as a live gate would make
  // this function disagree with the code it exists to protect.
  return parsed > 0 ? parsed : null;
}

export function checkNativeGate(facts: NativeGateFacts): NativeGateVerdict {
  const gate = parseGate(facts.gate);

  if (gate === null) return { ok: true, gate: null };

  if (Number.isNaN(gate)) {
    return {
      ok: false,
      reason: "malformed",
      problem:
        `min_update_version must be a native build number, not a version name - got ` +
        `"${String(facts.gate)}". A value like "2.4.0" parses to 0, which disables the gate ` +
        `entirely rather than setting it.`,
    };
  }

  const available = facts.channelNativeCode;

  if (available === null || available < gate) {
    return {
      ok: false,
      reason: "unsatisfiable",
      gate,
      available,
      problem:
        `This bundle needs native build ${gate}, and "${facts.channelName}" ` +
        (available === null ? "serves no native release at all" : `serves build ${available}`) +
        `. Devices would be told an update is required and offered nothing to install - ` +
        `they would stop updating silently. Publish the native build to "${facts.channelName}" ` +
        `first, then this bundle.`,
    };
  }

  return { ok: true, gate };
}
