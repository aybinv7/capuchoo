import type { Environment } from "@capuchoo/core";
import type { Channel } from "../types/release";

export const ENVIRONMENT_ORDER: readonly Environment[] = ["dev", "staging", "prod"];

const envRank = (environment: Environment) => ENVIRONMENT_ORDER.indexOf(environment);

/** dev, staging, prod, then by name. */
export function compareReleaseChannels(a: Channel, b: Channel): number {
  return envRank(a.environment) - envRank(b.environment) || a.name.localeCompare(b.name);
}

export interface ChannelRow {
  channel: Channel;
  depth: 0 | 1;
}

/**
 * Release channels in promotion order, each followed by the client channels that follow it. A
 * client whose base is missing (deleted or not visible) is listed last rather than dropped.
 */
export function orderChannels(channels: readonly Channel[]): ChannelRow[] {
  const releases = channels.filter((channel) => channel.kind === "release");
  const clients = channels.filter((channel) => channel.kind === "client");
  const rows: ChannelRow[] = [];
  const placed = new Set<string>();
  for (const release of [...releases].sort(compareReleaseChannels)) {
    rows.push({ channel: release, depth: 0 });
    for (const client of clients
      .filter((entry) => entry.base_channel_id === release.id)
      .sort((a, b) => a.name.localeCompare(b.name))) {
      rows.push({ channel: client, depth: 1 });
      placed.add(client.id);
    }
  }
  for (const orphan of clients.filter((entry) => !placed.has(entry.id)))
    rows.push({ channel: orphan, depth: 1 });
  return rows;
}

export function clientsOf(base: Channel, channels: readonly Channel[]): Channel[] {
  return channels.filter((channel) => channel.base_channel_id === base.id);
}

export const CHANNEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
