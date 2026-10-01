import {
  listAppRows,
  listChannels,
  listIdentifiers,
  listInstalled,
  listNatives,
  type App,
  type Channel,
  type NativeBuild,
} from "@/domains/catalog/catalog.repository";
import { getDatabase, useReactiveQuery } from "@/shared/database";
import type { Environment } from "@/shared/database/schema";
import { phoneStatus, type PhoneStatus } from "@/shared/release/phone-status";

export const ENVIRONMENT_ORDER: readonly Environment[] = ["dev", "staging", "prod"];

export interface LaneSummary {
  channel: Channel;
  build: NativeBuild | null;
}

export interface AppSummary {
  app: App;
  /** Release channels in promotion order: dev, staging, prod, then any other. */
  lanes: LaneSummary[];
  clientCount: number;
  phone: PhoneStatus;
}

export function laneOrder(channel: Channel): number {
  const index = channel.environment ? ENVIRONMENT_ORDER.indexOf(channel.environment) : -1;
  return index === -1 ? ENVIRONMENT_ORDER.length : index;
}

export async function loadAppSummaries(): Promise<AppSummary[]> {
  const db = getDatabase().db;
  const [apps, channels, natives, identifiers, installed] = await Promise.all([
    listAppRows(db),
    listChannels(db),
    listNatives(db),
    listIdentifiers(db),
    listInstalled(db),
  ]);
  const nativeById = new Map(natives.map((native) => [native.id, native]));

  return apps.map((app) => {
    const own = channels.filter((channel) => channel.app_id === app.id);
    const lanes = own
      .filter((channel) => channel.kind === "release")
      .sort((a, b) => laneOrder(a) - laneOrder(b) || a.name.localeCompare(b.name))
      .map((channel) => ({
        channel,
        build: channel.current_native_id ? (nativeById.get(channel.current_native_id) ?? null) : null,
      }));
    return {
      app,
      lanes,
      clientCount: own.filter((channel) => channel.kind === "client").length,
      phone: phoneStatus({
        identifiers: identifiers.filter((row) => row.app_id === app.id),
        installed: installed.filter((row) => row.app_id === app.id),
        channels: own,
        natives: natives.filter((native) => native.app_id === app.id),
      }),
    };
  });
}

export function useAppsOverview(search: Ref<string>) {
  const query = useReactiveQuery(loadAppSummaries, {
    tables: ["app", "channel", "native_build", "app_identifier", "installed"],
    queryKey: ["apps:overview"],
    debounce: 120,
  });

  const filtered = computed(() => {
    const term = search.value.trim().toLowerCase();
    const all = query.data.value ?? [];
    if (!term) return all;
    return all.filter(({ app }) => app.name.toLowerCase().includes(term) || app.bundle_id.toLowerCase().includes(term));
  });

  /** Apps this phone runs behind their channel, first - they are the ones to act on. */
  const behind = computed(() => (query.data.value ?? []).filter((summary) => summary.phone.state === "behind"));

  return { summaries: filtered, behind, loading: query.loading, error: query.error };
}
