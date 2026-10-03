import type {
  RecordingPolicyPatch,
  RecordingRuleScope,
  ResolvedRecordingPolicy,
} from "@capuchoo/core";
import { ApiError } from "@/shared/api/errors";
import { http, requestText } from "@/shared/api/http";
import {
  normalizeCheckIn,
  normalizeDetail,
  normalizeRule,
  normalizeSession,
} from "../lib/normalize";
import type {
  RecorderCheckIn,
  RecordingDetail,
  RecordingFilters,
  RecordingPage,
  RecordingRules,
  RecordingSession,
} from "../types/recordings.types";

export const RECORDING_PAGE_SIZE = 50;

export async function fetchRecordings(
  appId: string,
  filters: RecordingFilters,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<RecordingPage> {
  const page = await http.get<{ sessions?: unknown[]; next_cursor?: unknown }>(
    `/apps/${encodeURIComponent(appId)}/recordings`,
    {
      limit: RECORDING_PAGE_SIZE,
      before: cursor,
      device_id: filters.deviceId,
      version: filters.version,
      errors: filters.errors ? "true" : undefined,
      start: filters.start,
    },
    signal,
  );
  return {
    sessions: (page?.sessions ?? [])
      .map(normalizeSession)
      .filter((session): session is RecordingSession => session !== null),
    nextCursor: typeof page?.next_cursor === "string" ? page.next_cursor : null,
  };
}

export async function fetchRecording(id: string, signal?: AbortSignal): Promise<RecordingDetail> {
  const detail = normalizeDetail(
    await http.get<unknown>(`/recordings/${encodeURIComponent(id)}`, undefined, signal),
  );
  if (!detail) {
    throw new ApiError(
      502,
      "The server sent a recording the dashboard cannot read.",
      "bad_payload",
    );
  }
  return detail;
}

/** One segment's NDJSON; served gzip, inflated by the browser. */
export const fetchSegmentText = (id: string, seq: number, signal?: AbortSignal) =>
  requestText(`/recordings/${encodeURIComponent(id)}/segments/${seq}`, signal);

export const fetchAssetText = (assetId: string, signal?: AbortSignal) =>
  requestText(`/recording-assets/${encodeURIComponent(assetId)}`, signal);

/** Absolute, because a stylesheet served from a blob: URL cannot resolve a path against it. */
export const assetUrl = (assetId: string) =>
  `${window.location.origin}/api/recording-assets/${encodeURIComponent(assetId)}`;

export const deleteRecording = (id: string) => http.delete(`/recordings/${encodeURIComponent(id)}`);

export async function fetchRules(appId: string, signal?: AbortSignal): Promise<RecordingRules> {
  const body = await http.get<Record<string, unknown>>(
    `/apps/${encodeURIComponent(appId)}/recording-rules`,
    undefined,
    signal,
  );
  return {
    rules: Array.isArray(body.rules)
      ? body.rules.map(normalizeRule).filter((rule) => rule !== null)
      : [],
    defaults: body.defaults as RecordingRules["defaults"],
    limits: body.limits as RecordingRules["limits"],
  };
}

export interface RuleWrite {
  scope: RecordingRuleScope;
  channelId?: string | null;
  deviceId?: string | null;
  policy?: RecordingPolicyPatch;
  /** Minutes of live recording from now; `null` ends it. */
  liveMinutes?: number | null;
}

export const saveRule = (appId: string, write: RuleWrite) =>
  http.put<{ rule: unknown; dropped: string[] }>(
    `/apps/${encodeURIComponent(appId)}/recording-rules`,
    {
      scope: write.scope,
      channel_id: write.channelId ?? undefined,
      device_id: write.deviceId ?? undefined,
      policy: write.policy,
      live_minutes: write.liveMinutes,
    },
  );

export const deleteRule = (ruleId: string) =>
  http.delete(`/recording-rules/${encodeURIComponent(ruleId)}`);

export const fetchDevicePolicy = (deviceId: string, signal?: AbortSignal) =>
  http.get<{ policy: ResolvedRecordingPolicy; channel_id: string | null }>(
    `/devices/${encodeURIComponent(deviceId)}/recording-policy`,
    undefined,
    signal,
  );

export interface DeviceOption {
  id: string;
  label: string;
  detail: string;
}

/** Devices matching a search, for choosing one to give its own rule. */
export async function searchDevices(
  appId: string,
  search: string,
  signal?: AbortSignal,
): Promise<DeviceOption[]> {
  const page = await http.get<{ devices?: Array<Record<string, unknown>> }>(
    `/apps/${encodeURIComponent(appId)}/devices`,
    { search: search.trim(), limit: 20 },
    signal,
  );
  return (page?.devices ?? []).flatMap((device) => {
    if (typeof device.id !== "string") return [];
    const name =
      [device.manufacturer, device.model].filter((part) => typeof part === "string").join(" ") ||
      (typeof device.device_id === "string" ? device.device_id : device.id);
    return [
      {
        id: device.id,
        label: typeof device.custom_id === "string" && device.custom_id ? device.custom_id : name,
        detail: `${name} · ${typeof device.version_name === "string" ? device.version_name : "builtin"}`,
      },
    ];
  });
}

/** A device's name for a rule list: its custom id, else its hardware. */
export async function fetchDeviceLabel(deviceId: string, signal?: AbortSignal): Promise<string> {
  const device = await http.get<Record<string, unknown>>(
    `/devices/${encodeURIComponent(deviceId)}`,
    undefined,
    signal,
  );
  if (typeof device?.custom_id === "string" && device.custom_id) return device.custom_id;
  const hardware = [device?.manufacturer, device?.model].filter((part) => typeof part === "string");
  return (
    hardware.join(" ") || (typeof device?.device_id === "string" ? device.device_id : deviceId)
  );
}

/** Devices whose recorder asked for its policy lately, newest first, with the health they reported. */
export async function fetchRecorderHealth(
  appId: string,
  signal?: AbortSignal,
): Promise<RecorderCheckIn[]> {
  const body = await http.get<{ devices?: unknown[] }>(
    `/apps/${encodeURIComponent(appId)}/recorder-health`,
    undefined,
    signal,
  );
  return (body?.devices ?? [])
    .map(normalizeCheckIn)
    .filter((entry): entry is RecorderCheckIn => entry !== null);
}
