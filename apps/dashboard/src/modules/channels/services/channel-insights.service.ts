import { normalizeActivity } from "@/shared/activity/lib/normalize-activity";
import type { Activity, ActivityWindow } from "@/shared/activity/types";
import { http } from "@/shared/api/http";
import { normalizeBuild } from "@/shared/live/normalize";
import type { Build } from "@/shared/types/build";
import { normalizeRollout } from "../lib/normalize-rollout";
import type { ChannelRollout } from "../types/channel-insights.types";

const channelPath = (channelId: string) => `/channels/${encodeURIComponent(channelId)}`;

export const fetchChannelRollout = async (
  channelId: string,
  tz: string,
  signal?: AbortSignal,
): Promise<ChannelRollout> =>
  normalizeRollout(await http.get<unknown>(`${channelPath(channelId)}/rollout`, { tz }, signal), {
    tz,
  });

export const fetchChannelActivity = async (
  channelId: string,
  window: ActivityWindow,
  signal?: AbortSignal,
): Promise<Activity> =>
  normalizeActivity(
    await http.get<unknown>(
      `${channelPath(channelId)}/activity`,
      { from: window.from, to: window.to, bucket: window.bucket, tz: window.tz },
      signal,
    ),
    window,
  );

/** Top-level runs and deploys that targeted a channel, newest first. */
export const fetchChannelBuilds = async (
  appId: string,
  channelId: string,
  limit: number,
  signal?: AbortSignal,
): Promise<Build[]> => {
  const rows = await http.get<unknown>(
    `/apps/${encodeURIComponent(appId)}/builds`,
    { channel_id: channelId, scope: "top", limit },
    signal,
  );
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeBuild)
    .filter((build): build is Build => build !== null && !build.parent_id);
};
