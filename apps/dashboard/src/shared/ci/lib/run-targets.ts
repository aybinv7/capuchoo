import type { Environment } from "@capuchoo/core";
import type { Channel, ReleaseCatalog } from "../../types/release";

export interface ChannelGroup {
  environment: Environment;
  channels: Channel[];
}

const ORDER: readonly Environment[] = ["dev", "staging", "prod"];

/** Release channels a run can publish to, grouped in promotion order. */
export function releaseChannelGroups(channels: readonly Channel[]): ChannelGroup[] {
  return ORDER.map((environment) => ({
    environment,
    channels: channels
      .filter((channel) => channel.kind === "release" && channel.environment === environment)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.channels.length > 0);
}

export const clientChannels = (channels: readonly Channel[]): Channel[] =>
  channels
    .filter((channel) => channel.kind === "client")
    .sort((a, b) => a.name.localeCompare(b.name));

/**
 * The version a delivery to `clientName` would most likely pin: what the client's base channel
 * serves now. Null when the client, its base or the base's bundle is unknown.
 */
export function suggestedDeliverVersion(
  catalog: ReleaseCatalog,
  clientName: string,
): string | null {
  const name = clientName.trim().toLowerCase();
  if (!name) return null;
  const client = catalog.channels.find(
    (channel) =>
      channel.kind === "client" && (channel.name === name || channel.name === `prod-${name}`),
  );
  const base = client?.base_channel_id
    ? catalog.channels.find((channel) => channel.id === client.base_channel_id)
    : null;
  const bundleId = base?.current_bundle_id;
  if (!bundleId) return null;
  return catalog.bundles.find((bundle) => bundle.id === bundleId)?.version_name ?? null;
}
