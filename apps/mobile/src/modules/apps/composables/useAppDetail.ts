import { listAppActivity } from "@/domains/activity/activity.repository";
import {
  getApp,
  listBundles,
  listChannels,
  listIdentifiers,
  listInstalled,
  listNatives,
  type Bundle,
  type Channel,
  type NativeBuild,
} from "@/domains/catalog/catalog.repository";
import { getDatabase, useReactiveQuery } from "@/shared/database";
import { phoneStatus } from "@/shared/release/phone-status";
import { syncApp } from "@/shared/sync/sync";
import { laneOrder } from "./useAppsOverview";

export interface ChannelView {
  channel: Channel;
  native: NativeBuild | null;
  bundle: Bundle | null;
  base: Channel | null;
}

async function loadAppDetail(appId: string) {
  const db = getDatabase().db;
  const [app, channels, natives, bundles, identifiers, installed, activity] = await Promise.all([
    getApp(db, appId),
    listChannels(db, appId),
    listNatives(db, appId),
    listBundles(db, appId),
    listIdentifiers(db, appId),
    listInstalled(db, appId),
    listAppActivity(db, appId, 8),
  ]);
  if (!app) return null;

  const nativeById = new Map(natives.map((native) => [native.id, native]));
  const bundleById = new Map(bundles.map((bundle) => [bundle.id, bundle]));
  const channelById = new Map(channels.map((channel) => [channel.id, channel]));
  const views: ChannelView[] = channels
    .map((channel) => ({
      channel,
      native: channel.current_native_id ? (nativeById.get(channel.current_native_id) ?? null) : null,
      bundle: channel.current_bundle_id ? (bundleById.get(channel.current_bundle_id) ?? null) : null,
      base: channel.base_channel_id ? (channelById.get(channel.base_channel_id) ?? null) : null,
    }))
    .sort(
      (a, b) =>
        Number(a.channel.kind === "client") - Number(b.channel.kind === "client") ||
        laneOrder(a.channel) - laneOrder(b.channel) ||
        a.channel.name.localeCompare(b.channel.name),
    );

  return {
    app,
    channels: views,
    natives,
    identifiers,
    installed,
    activity,
    phone: phoneStatus({ identifiers, installed, channels, natives }),
  };
}

export type AppDetailData = NonNullable<Awaited<ReturnType<typeof loadAppDetail>>>;

export function useAppDetail(appId: string) {
  const query = useReactiveQuery(() => loadAppDetail(appId), {
    tables: ["app", "channel", "native_build", "bundle", "app_identifier", "installed", "activity"],
    queryKey: ["apps:detail", appId],
    debounce: 80,
  });

  const refreshing = ref(false);
  async function refresh(): Promise<void> {
    refreshing.value = true;
    try {
      await syncApp(appId);
    } finally {
      refreshing.value = false;
    }
  }

  return { detail: query.data, loading: query.loading, refreshing, refresh };
}
