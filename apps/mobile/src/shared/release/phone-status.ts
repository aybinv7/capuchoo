import type { Environment } from "@/shared/database/schema";

export interface StatusIdentifier {
  bundle_id: string;
  flavour: Environment | null;
}

export interface StatusInstalled {
  bundle_id: string;
  installed: number;
  version_name: string | null;
  version_code: number | null;
}

export interface StatusChannel {
  id: string;
  name: string;
  environment: Environment | null;
  kind: "release" | "client";
  paused: number;
  current_native_id: string | null;
}

export interface StatusNative {
  id: string;
  version_name: string;
  version_code: number;
}

export type PhoneState = "absent" | "current" | "behind" | "ahead" | "untracked";

export interface PhoneStatus {
  state: PhoneState;
  bundleId: string | null;
  installedName: string | null;
  installedCode: number | null;
  /** The release channel this install follows: its flavour's, or prod for a shared id. */
  channel: StatusChannel | null;
  target: StatusNative | null;
}

/** The release channel an install of `flavour` takes its builds from. */
export function followedChannel(
  channels: readonly StatusChannel[],
  flavour: Environment | null,
): StatusChannel | null {
  const environment = flavour ?? "prod";
  const release = channels.filter((channel) => channel.kind === "release" && channel.environment === environment);
  return release.find((channel) => channel.name === environment) ?? release[0] ?? null;
}

/**
 * Where this phone stands for one app. A device reports the package it was built under, so the
 * installed identifier says which flavour it is, and that flavour says which channel's build it
 * should run. When several of an app's flavours are installed side by side, the one most behind
 * is reported: it is the one that needs attention.
 */
export function phoneStatus(input: {
  identifiers: readonly StatusIdentifier[];
  installed: readonly StatusInstalled[];
  channels: readonly StatusChannel[];
  natives: readonly StatusNative[];
}): PhoneStatus {
  const natives = new Map(input.natives.map((native) => [native.id, native]));
  const installed = new Map(input.installed.filter((row) => row.installed).map((row) => [row.bundle_id, row]));

  const candidates = input.identifiers
    .filter((identifier) => installed.has(identifier.bundle_id))
    .map((identifier) => {
      const row = installed.get(identifier.bundle_id)!;
      const channel = followedChannel(input.channels, identifier.flavour);
      const target = channel?.current_native_id ? (natives.get(channel.current_native_id) ?? null) : null;
      const code = row.version_code ?? 0;
      const state: PhoneState = !target
        ? "untracked"
        : target.version_code > code
          ? "behind"
          : target.version_code < code
            ? "ahead"
            : "current";
      return {
        state,
        bundleId: identifier.bundle_id,
        installedName: row.version_name,
        installedCode: row.version_code,
        channel,
        target,
      } satisfies PhoneStatus;
    });

  if (candidates.length === 0) {
    const channel = followedChannel(input.channels, null);
    const target = channel?.current_native_id ? (natives.get(channel.current_native_id) ?? null) : null;
    return {
      state: "absent",
      bundleId: input.identifiers.find((identifier) => identifier.flavour === null)?.bundle_id ?? input.identifiers[0]?.bundle_id ?? null,
      installedName: null,
      installedCode: null,
      channel,
      target,
    };
  }

  const urgency: Record<PhoneState, number> = { behind: 0, ahead: 1, current: 2, untracked: 3, absent: 4 };
  return candidates.sort((a, b) => urgency[a.state] - urgency[b.state])[0]!;
}
