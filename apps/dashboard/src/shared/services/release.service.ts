import { http } from "../api/http";
import type { Channel, ChannelDetail, ChannelHistoryEntry, ReleaseCatalog } from "../types/release";

export const fetchCatalog = (appId: string, signal?: AbortSignal) =>
  http.get<ReleaseCatalog>(`/apps/${appId}/artefacts`, undefined, signal);

export const fetchChannel = (channelId: string, signal?: AbortSignal) =>
  http.get<ChannelDetail>(`/channels/${channelId}`, undefined, signal);

export const fetchChannelHistory = (channelId: string, limit = 100, signal?: AbortSignal) =>
  http.get<ChannelHistoryEntry[]>(`/channels/${channelId}/history`, { limit }, signal);

export interface PointInput {
  bundle_id?: string;
  native_id?: string;
  rollback?: boolean;
  reason?: string | null;
}

export const pointChannel = (channelId: string, input: PointInput) =>
  http.post<Channel>(`/channels/${channelId}/point`, input);

export const pauseChannel = (channelId: string, reason: string | null) =>
  http.post<Channel>(`/channels/${channelId}/pause`, { reason });

export const resumeChannel = (channelId: string, reason: string | null) =>
  http.post<Channel>(`/channels/${channelId}/resume`, { reason });
