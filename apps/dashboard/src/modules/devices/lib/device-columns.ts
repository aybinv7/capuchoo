import type { AnyColumnDef } from "@/shared/components/data-table";
import { actionsColumn, selectionColumn } from "@/shared/components/data-table";
import type { Device } from "../types/devices.types";
import { attributesText } from "./device-attributes";

export function deviceTitle(device: Device): string {
  return (
    device.device_name ||
    [device.manufacturer, device.model].filter(Boolean).join(" ") ||
    "Unknown device"
  );
}

export const deviceChannelName = (device: Device) =>
  device.channel_name ?? device.reported_channel ?? "";

/**
 * Device columns. Search and the channel and last-seen facets are answered by the server, so these
 * accessors serve sorting of a fully loaded list and exports.
 */
export const DEVICE_COLUMNS: AnyColumnDef<Device>[] = [
  selectionColumn<Device>(),
  { id: "device", accessorFn: deviceTitle, size: 240, meta: { title: "Device" } },
  {
    id: "attributes",
    accessorFn: (device) => attributesText(device.attributes),
    enableSorting: false,
    size: 280,
    meta: { title: "Attributes" },
  },
  {
    id: "device_id",
    accessorFn: (device) => device.device_id,
    size: 260,
    meta: { title: "Device id", defaultHidden: true },
  },
  {
    id: "custom_id",
    accessorFn: (device) => device.custom_id ?? "",
    size: 160,
    meta: { title: "Custom id", defaultHidden: true },
  },
  {
    id: "platform",
    accessorFn: (device) => device.platform,
    size: 120,
    meta: { title: "Platform" },
  },
  {
    id: "ota",
    accessorFn: (device) => device.version_name ?? "",
    sortingFn: "alphanumeric",
    size: 130,
    meta: { title: "OTA bundle" },
  },
  {
    id: "native",
    accessorFn: (device) => device.version_builtin ?? "",
    sortingFn: "alphanumeric",
    size: 150,
    meta: {
      title: "Native",
      exportValue: (device) =>
        device.version_builtin
          ? `${device.version_builtin}${device.version_code ? ` (${device.version_code})` : ""}`
          : null,
    },
  },
  { id: "channel", accessorFn: deviceChannelName, size: 170, meta: { title: "Channel" } },
  {
    id: "build",
    accessorFn: (device) => (device.is_prod === false ? "debug" : "release"),
    size: 100,
    meta: { title: "Build", defaultHidden: true },
  },
  {
    id: "emulator",
    accessorFn: (device) => Boolean(device.is_emulator),
    size: 100,
    meta: { title: "Emulator", defaultHidden: true },
  },
  {
    id: "plugin",
    accessorFn: (device) => device.plugin_version ?? "",
    size: 110,
    meta: { title: "Updater", defaultHidden: true },
  },
  {
    id: "last_seen",
    accessorFn: (device) => device.last_seen_at,
    sortingFn: "basic",
    size: 130,
    meta: { title: "Last seen", align: "right" },
  },
  {
    id: "first_seen",
    accessorFn: (device) => device.created_at,
    sortingFn: "basic",
    size: 130,
    meta: { title: "First seen", align: "right", defaultHidden: true },
  },
  actionsColumn<Device>(),
];
