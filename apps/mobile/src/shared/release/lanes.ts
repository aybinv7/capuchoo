import type { Channel, NativeBuild } from "@/domains/catalog/catalog.repository";
import type { Environment } from "@/shared/database/schema";

export const ENVIRONMENT_ORDER: readonly Environment[] = ["dev", "staging", "prod"];

export interface LaneSummary {
  channel: Channel;
  build: NativeBuild | null;
}

/** Promotion order: dev, staging, prod, then any channel without an environment. */
export function laneOrder(channel: Channel): number {
  const index = channel.environment ? ENVIRONMENT_ORDER.indexOf(channel.environment) : -1;
  return index === -1 ? ENVIRONMENT_ORDER.length : index;
}

/** Release channels first, in promotion order, then client channels, each by name. */
export function compareChannels(a: Channel, b: Channel): number {
  return (
    Number(a.kind === "client") - Number(b.kind === "client") ||
    laneOrder(a) - laneOrder(b) ||
    a.name.localeCompare(b.name)
  );
}

export function releaseLanes(channels: Channel[], natives: NativeBuild[]): LaneSummary[] {
  const nativeById = new Map(natives.map((native) => [native.id, native]));
  return channels
    .filter((channel) => channel.kind === "release")
    .sort(compareChannels)
    .map((channel) => ({
      channel,
      build: channel.current_native_id ? (nativeById.get(channel.current_native_id) ?? null) : null,
    }));
}
