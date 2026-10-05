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
import { compareChannels } from "@/shared/release/lanes";
import { phoneStatus } from "@/shared/release/phone-status";
import { currentAppId } from "@/shared/session/currentApp";
import { syncApp } from "@/shared/sync/sync";

export interface ChannelView {
  channel: Channel;
  native: NativeBuild | null;
  bundle: Bundle | null;
  base: Channel | null;
}

async function loadAppRelease(appId: string) {
  const db = getDatabase().db;
  const [app, channels, natives, bundles, identifiers, installed, activity] = await Promise.all([
    getApp(db, appId),
    listChannels(db, appId),
    listNatives(db, appId),
    listBundles(db, appId),
    listIdentifiers(db, appId),
    listInstalled(db, appId),
    listAppActivity(db, appId, 40),
  ]);
  if (!app) return null;

  const nativeById = new Map(natives.map((native) => [native.id, native]));
  const bundleById = new Map(bundles.map((bundle) => [bundle.id, bundle]));
  const channelById = new Map(channels.map((channel) => [channel.id, channel]));
  const views: ChannelView[] = [...channels].sort(compareChannels).map((channel) => ({
    channel,
    native: channel.current_native_id ? (nativeById.get(channel.current_native_id) ?? null) : null,
    bundle: channel.current_bundle_id ? (bundleById.get(channel.current_bundle_id) ?? null) : null,
    base: channel.base_channel_id ? (channelById.get(channel.base_channel_id) ?? null) : null,
  }));

  return {
    app,
    channels: views,
    natives,
    bundles,
    identifiers,
    installed,
    activity,
    phone: phoneStatus({ identifiers, installed, channels, natives }),
  };
}

export type AppRelease = NonNullable<Awaited<ReturnType<typeof loadAppRelease>>>;

/**
 * The current app's channels, builds and what this phone runs, read live from SQLite. Every tab
 * shares the one query key, so the tabs read it once between them.
 */
export function useAppRelease() {
  const appId = computed(() => currentAppId.value ?? "");
  const query = useReactiveQuery(() => loadAppRelease(appId.value), {
    tables: ["app", "channel", "native_build", "bundle", "app_identifier", "installed", "activity"],
    queryKey: () => ["apps:release", appId.value],
    debounce: 80,
  });

  async function refresh(): Promise<void> {
    if (appId.value) await syncApp(appId.value);
  }

  return { release: query.data, loading: query.loading, appId, refresh };
}
