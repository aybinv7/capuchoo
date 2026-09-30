import type { Channel, Device } from "../db/schema";

export type ChannelSource = "assigned" | "self" | "reported" | "none";

/**
 * Which channel serves a device: a dashboard assignment wins, then a choice the device made for
 * itself (only on a channel that allows it), then the channel its build reports.
 */
export function resolveDeviceChannel(input: {
  channels: readonly Channel[];
  device: Pick<Device, "assigned_channel_id" | "self_channel_id"> | undefined;
  reported: string | undefined;
}): { channel: Channel | null; source: ChannelSource } {
  const byId = (id: string | null) =>
    id ? input.channels.find((channel) => channel.id === id) : undefined;

  const assigned = byId(input.device?.assigned_channel_id ?? null);
  if (assigned) return { channel: assigned, source: "assigned" };

  const self = byId(input.device?.self_channel_id ?? null);
  if (self?.allow_device_self_set) return { channel: self, source: "self" };

  const reported = input.reported
    ? input.channels.find((channel) => channel.name === input.reported)
    : undefined;
  if (reported) return { channel: reported, source: "reported" };

  return { channel: null, source: "none" };
}
