import type { Device } from "@/domains/insights/insights.repository";

const DAY_MS = 86_400_000;

/** What a person calls the phone: its name, else its model, else the start of its id. */
export function deviceTitle(device: Device): string {
  return device.device_name || device.model || device.custom_id || device.device_id.slice(0, 12);
}

export function isActive(device: Device, now = Date.now()): boolean {
  return now - Date.parse(device.last_seen_at) < DAY_MS;
}

/** The channel the server last served the device from, which is what its health is counted by. */
export function servedChannelId(device: Device): string | null {
  return device.channel_id;
}
