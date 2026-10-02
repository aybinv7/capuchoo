import type { Device, DeviceDetail, DevicePage } from "../types/devices.types";

const isPage = (value: unknown): value is DevicePage =>
  typeof value === "object" && value !== null && Array.isArray((value as DevicePage).devices);

/**
 * The row a devices table already loaded for `id`, shaped as a detail without its summary, so the
 * device page can draw its header at once. Only paged table data is read: other entries under the
 * devices prefix (the command palette's hits) carry a partial row.
 */
export function findListedDevice(
  entries: ReadonlyArray<readonly [unknown, unknown]>,
  id: string,
): DeviceDetail | undefined {
  for (const [, data] of entries) {
    const pages = (data as { pages?: unknown } | undefined)?.pages;
    if (!Array.isArray(pages)) continue;
    for (const page of pages) {
      if (!isPage(page)) continue;
      const row: Device | undefined = page.devices.find((device) => device.id === id);
      if (row) return { ...row, channel: null, assigned_channel: null, summary: null };
    }
  }
  return undefined;
}
