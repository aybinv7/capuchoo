import { http } from "../api/http";

export const DEVICE_HIT_LIMIT = 6;

/** The fields of a device the palette shows; the endpoint returns more. */
export interface DeviceHit {
  id: string;
  device_id: string;
  custom_id: string | null;
  device_name: string | null;
  manufacturer: string | null;
  model: string | null;
  platform: string;
  version_name: string | null;
  channel_name: string | null;
  reported_channel: string | null;
}

export const searchDevices = (appId: string, term: string, signal?: AbortSignal) =>
  http.get<{ devices: DeviceHit[]; total: number }>(
    `/apps/${appId}/devices`,
    { limit: DEVICE_HIT_LIMIT, offset: 0, search: term },
    signal,
  );
