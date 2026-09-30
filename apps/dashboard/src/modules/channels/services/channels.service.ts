import { http } from "@/shared/api/http";
import type { Channel } from "@/shared/types/release";
import type { ChannelPatch, CreateChannelInput } from "../types/channels.types";

export const createChannel = (input: CreateChannelInput) => http.post<Channel>("/channels", input);

export const updateChannel = (channelId: string, patch: ChannelPatch) =>
  http.put<Channel>(`/channels/${channelId}`, patch);

export const deleteChannel = (channelId: string, appId: string) =>
  http.delete(`/channels/${channelId}`, { app_id: appId });
