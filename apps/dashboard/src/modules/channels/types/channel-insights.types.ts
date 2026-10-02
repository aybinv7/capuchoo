import type { DeviceAttributes } from "@capuchoo/core";

/** The last pointer move to the bundle a channel serves now. */
export interface RolloutCurrent {
  bundle_id: string;
  version: string;
  delivered_at: string | null;
  delivered_by: string | null;
  from_version: string | null;
  rollback: boolean;
}

/** One version and how many of the channel's devices run it. */
export interface VersionShare {
  /** A version, `builtin` for no bundle applied, or `other` for the long tail. */
  version: string;
  devices: number;
  current: boolean;
}

/** A device not on the current version. */
export interface BehindDevice {
  id: string;
  device_id: string;
  custom_id: string | null;
  device_name: string | null;
  model: string | null;
  /** Not in the contract yet; drawn as an unknown platform when absent. */
  platform: string | null;
  attributes: DeviceAttributes | null;
  version_name: string | null;
  last_seen_at: string | null;
}

/** Cumulative devices that took the current version by the end of a local day. */
export interface CurvePoint {
  day: string;
  devices: number;
}

/** `GET /api/channels/:id/rollout`. */
export interface ChannelRollout {
  current: RolloutCurrent | null;
  devices: number;
  on_current: number;
  mix: VersionShare[];
  behind: BehindDevice[];
  curve: CurvePoint[];
  tz: string;
}
