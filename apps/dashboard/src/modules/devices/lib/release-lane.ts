import type { Alignment } from "./channel-alignment";

export type LaneTone = "success" | "warning" | "info" | "muted";

export interface LaneStatus {
  tone: LaneTone;
  text: string;
}

/** What a version node says about the channel: on it, behind it, ahead of it, or nothing. */
export function alignmentStatus(alignment: Alignment): LaneStatus | null {
  switch (alignment.state) {
    case "current":
      return { tone: "success", text: "on channel" };
    case "behind":
      return { tone: "warning", text: `behind · channel ${alignment.served}` };
    case "ahead":
      return { tone: "info", text: `ahead · channel ${alignment.served}` };
    case "different":
      return { tone: "warning", text: `channel serves ${alignment.served}` };
    case "unknown":
      return alignment.served ? { tone: "muted", text: `channel ${alignment.served}` } : null;
  }
}

/** The built-in bundle sentinel the updater reports before any OTA bundle is applied. */
export const BUILTIN_BUNDLE = "builtin";

/** The OTA node's value: the bundle, `built-in` before any is applied, null when unknown. */
export function otaLabel(versionName: string | null): string | null {
  if (!versionName) return null;
  return versionName === BUILTIN_BUNDLE ? "built-in" : versionName;
}

/** The channel node's hint: dashboard assignment first, then a build that names another channel. */
export function channelHint(
  device: {
    assigned_channel_id: string | null;
    assigned_channel: { name: string } | null;
    reported_channel: string | null;
  },
  channelName: string | null,
): string | null {
  if (device.assigned_channel || device.assigned_channel_id) return "assigned from the dashboard";
  if (device.reported_channel && device.reported_channel !== channelName)
    return `build says ${device.reported_channel}`;
  return null;
}
