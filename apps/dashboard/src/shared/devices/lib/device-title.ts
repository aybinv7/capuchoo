/** The fields a device is named by; any of them may be missing on a partial row. */
export interface NamedDevice {
  device_name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
}

/** The name a device goes by: its own name, else maker and model, else `Unknown device`. */
export function deviceTitle(device: NamedDevice): string {
  return (
    device.device_name ||
    [device.manufacturer, device.model].filter(Boolean).join(" ") ||
    "Unknown device"
  );
}
