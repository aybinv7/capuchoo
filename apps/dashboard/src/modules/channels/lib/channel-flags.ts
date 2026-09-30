import type { ChannelFlag } from "../types/channels.types";

export interface FlagDescriptor {
  key: ChannelFlag;
  label: string;
  description: string;
}

/** The channel settings that change what a device is served, in the order they are read. */
export const DELIVERY_FLAGS: readonly FlagDescriptor[] = [
  { key: "android_enabled", label: "Android", description: "Serve Android devices." },
  { key: "ios_enabled", label: "iOS", description: "Serve iOS devices." },
  {
    key: "allow_dev",
    label: "Development builds",
    description: "Serve devices running a debug build of the app.",
  },
  { key: "allow_emulator", label: "Emulators", description: "Serve emulators and simulators." },
  {
    key: "allow_device_self_set",
    label: "Device self-selection",
    description: "A device may move itself onto this channel.",
  },
  {
    key: "public",
    label: "Public",
    description: "Devices that name no channel can be resolved to this one.",
  },
];

const POINTER_ACTIONS = new Set([
  "point_bundle",
  "point_native",
  "rollback_bundle",
  "rollback_native",
]);

/** Mirrors the server's lock: an environment is fixed once the channel has pointed at anything. */
export function hasServed(history: readonly { action: string }[]): boolean {
  return history.some((entry) => POINTER_ACTIONS.has(entry.action));
}
