/**
 * Whether a channel may point at an artefact. Every pointer write - upload, promote, dashboard
 * edit, CLI - goes through `canPoint`, so the rules live in one place.
 */

import { checkNativeGate, type NativeGate } from "./native-gate.js";
import type { Environment, Platform } from "./update-contract.js";
import { compareVersions } from "./version.js";

/** `release` channels take uploads; `client` channels follow a base release channel. */
export type ChannelKind = "release" | "client";

export type ArtefactKind = "ota" | "native";

export interface PointerChannel {
  appId: string;
  name: string;
  environment: Environment;
  kind: ChannelKind;
  iosEnabled?: boolean | undefined;
  androidEnabled?: boolean | undefined;
  /** Build number of the native release the channel serves now, or null. */
  currentNativeCode: number | null;
  /** `min_native_version` of the bundle the channel serves now, or null. */
  currentBundleGate: NativeGate;
  /** Version the channel serves now for the artefact kind being pointed, or null. */
  currentVersion: { versionName: string; versionCode?: number | null } | null;
}

export interface PointerArtefact {
  appId: string;
  kind: ArtefactKind;
  platform: Platform;
  flavour: Environment | null;
  versionName: string;
  /** Native build number; required for a native artefact. */
  versionCode?: number | null | undefined;
  /** OTA only: the native build a device needs before it may run this bundle. */
  minNativeVersion?: NativeGate;
}

export interface PointerFacts {
  channel: PointerChannel;
  artefact: PointerArtefact;
  /** Client channels only: whether the base channel has ever served this artefact. */
  servedByBase?: boolean | undefined;
  /** An explicit rollback: the only way a pointer may move to a lower version. */
  rollback?: boolean | undefined;
}

export type PointerRefusal =
  | "other-app"
  | "unflavoured"
  | "flavour-mismatch"
  | "platform-disabled"
  | "not-on-base"
  | "native-gate"
  | "strands-bundle"
  | "downgrade-needs-rollback"
  | "rollback-not-lower";

export type PointerVerdict =
  | { ok: true; direction: "forward" | "same" | "downgrade" }
  | { ok: false; reason: PointerRefusal; message: string };

function refuse(reason: PointerRefusal, message: string): PointerVerdict {
  return { ok: false, reason, message };
}

function direction(facts: PointerFacts): number {
  const current = facts.channel.currentVersion;
  if (!current) return 1;
  if (facts.artefact.kind === "native") {
    return (facts.artefact.versionCode ?? 0) - (current.versionCode ?? 0);
  }
  return compareVersions(facts.artefact.versionName, current.versionName);
}

/** Pure and total: the same facts always give the same verdict. */
export function canPoint(facts: PointerFacts): PointerVerdict {
  const { channel, artefact } = facts;
  const label = `${artefact.kind === "ota" ? "Bundle" : "Native build"} ${artefact.versionName}`;

  if (artefact.appId !== channel.appId) {
    return refuse("other-app", `${label} belongs to another app.`);
  }

  if (!artefact.flavour) {
    return refuse(
      "unflavoured",
      `${label} declares no flavour, so nothing proves it was built for "${channel.name}". Re-publish it with a current CLI.`,
    );
  }

  if (artefact.flavour !== channel.environment) {
    return refuse(
      "flavour-mismatch",
      `${label} was built from the ${artefact.flavour} flavour; "${channel.name}" serves ${channel.environment}.`,
    );
  }

  const platformOff =
    (artefact.platform === "ios" && channel.iosEnabled === false) ||
    (artefact.platform === "android" && channel.androidEnabled === false);
  if (platformOff) {
    return refuse("platform-disabled", `"${channel.name}" does not serve ${artefact.platform}.`);
  }

  if (channel.kind === "client" && !facts.servedByBase) {
    return refuse(
      "not-on-base",
      `${label} has never been served by the release channel "${channel.name}" follows. Deliver it there first.`,
    );
  }

  if (artefact.kind === "ota") {
    const gate = checkNativeGate({
      gate: artefact.minNativeVersion,
      channelNativeCode: channel.currentNativeCode,
      channelName: channel.name,
    });
    if (!gate.ok) return refuse("native-gate", gate.problem);
  } else {
    const strands = checkNativeGate({
      gate: channel.currentBundleGate,
      channelNativeCode: artefact.versionCode ?? null,
      channelName: channel.name,
    });
    if (!strands.ok && strands.reason === "unsatisfiable") {
      return refuse(
        "strands-bundle",
        `The bundle "${channel.name}" serves needs native build ${strands.gate}; ${label} is build ${artefact.versionCode ?? 0}. Devices would be stranded.`,
      );
    }
  }

  const delta = direction(facts);

  if (facts.rollback) {
    if (delta >= 0) {
      return refuse(
        "rollback-not-lower",
        `A rollback must point at a lower version than "${channel.name}" serves now.`,
      );
    }
    return { ok: true, direction: "downgrade" };
  }

  if (delta < 0) {
    return refuse(
      "downgrade-needs-rollback",
      `${label} is older than what "${channel.name}" serves. Devices never install an older version unless the move is a rollback.`,
    );
  }

  return { ok: true, direction: delta === 0 ? "same" : "forward" };
}
