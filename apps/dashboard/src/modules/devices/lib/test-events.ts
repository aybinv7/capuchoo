import type { ActivityEvent, DeviceEvent } from "../types/devices.types";

/** A device event for tests: an update check at noon unless overridden. */
export function deviceEvent(overrides: Partial<DeviceEvent> & { id: string }): DeviceEvent {
  return {
    kind: "ota",
    action: "get",
    category: "check",
    status: null,
    version_from: "1.0.0",
    version_to: null,
    version_code_to: null,
    error: null,
    channel_id: null,
    created_at: "2026-09-30T12:00:00.000Z",
    ...overrides,
  };
}

/** An app-wide event from device `deviceId`, or from a removed device when null. */
export function activityEvent(
  overrides: Partial<DeviceEvent> & { id: string },
  deviceId: string | null = "d-1",
): ActivityEvent {
  return {
    ...deviceEvent(overrides),
    device: deviceId
      ? { id: deviceId, custom_id: null, device_name: null, model: null, attributes: null }
      : null,
  };
}
