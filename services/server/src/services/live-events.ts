import type { Channel } from "../db/schema";
import type { Deps } from "../http/context";
import { serializeChannel } from "../http/serializers";

/** The one shape every `device` event on the live stream carries. */
export interface DeviceLiveEvent {
  device_uuid: string;
  device_id: string | null;
  channel_id: string | null;
  assigned_channel_id?: string | null;
  event: string;
  status: string | null;
  version: string | null;
  version_code: number | null;
  model: string | null;
  at: string;
}

export function publishDevice(deps: Deps, appId: string, event: DeviceLiveEvent): void {
  deps.hub.publish({ type: "device", appId, data: event });
}

/** Channel events carry the REST shape, so a client can merge them without translating. */
export function publishChannel(deps: Deps, channel: Channel): void {
  deps.cache.invalidate(`app:${channel.app_id}`);
  deps.hub.publish({ type: "channel", appId: channel.app_id, data: serializeChannel(channel) });
}
