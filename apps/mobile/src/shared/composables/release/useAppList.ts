import {
  listAppRows,
  listChannels,
  listNatives,
  listOrganizations,
  type App,
} from "@/domains/catalog/catalog.repository";
import { getDatabase, useReactiveQuery } from "@/shared/database";
import { releaseLanes, type LaneSummary } from "@/shared/release/lanes";

export interface AppChoice {
  app: App;
  organization: string | null;
  lanes: LaneSummary[];
}

async function loadAppChoices(): Promise<AppChoice[]> {
  const db = getDatabase().db;
  const [apps, organizations, channels, natives] = await Promise.all([
    listAppRows(db),
    listOrganizations(db),
    listChannels(db),
    listNatives(db),
  ]);
  const orgName = new Map(organizations.map((org) => [org.id, org.name]));
  return apps.map((app) => ({
    app,
    organization: orgName.get(app.organization_id) ?? null,
    lanes: releaseLanes(
      channels.filter((channel) => channel.app_id === app.id),
      natives.filter((native) => native.app_id === app.id),
    ),
  }));
}

/** Every app the account reaches, with where each release stands: what the picker offers. */
export function useAppList() {
  const query = useReactiveQuery(loadAppChoices, {
    tables: ["app", "organization", "channel", "native_build"],
    queryKey: ["apps:choices"],
    debounce: 120,
  });
  return { choices: computed(() => query.data.value ?? []), loading: query.loading };
}
