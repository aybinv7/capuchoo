import { storeToRefs } from "pinia";
import { computed, type Ref } from "vue";
import { useCurrentApp } from "../../composables/useCurrentApp";
import { useCommandStore } from "../../stores/command.store";
import { parseQuery, rankItems } from "../lib/rank";
import type { SearchItem, SearchScope } from "../types";
import { useActionItems } from "./useActionItems";
import { useCatalogItems } from "./useCatalogItems";
import { useDeviceHits } from "./useDeviceHits";
import { useNavigationItems } from "./useNavigationItems";

type ResultScope = Exclude<SearchScope, "all">;

export interface ResultGroup {
  key: string;
  label: string;
  items: SearchItem[];
}

export const SCOPE_LABELS: Record<ResultScope, string> = {
  pages: "Pages",
  apps: "Apps",
  channels: "Channels",
  releases: "Releases",
  builds: "Builds",
  devices: "Devices",
  actions: "Actions",
};

const ORDER: readonly ResultScope[] = [
  "pages",
  "channels",
  "releases",
  "builds",
  "devices",
  "apps",
  "actions",
];
const APP_SCOPES: ReadonlySet<ResultScope> = new Set(["channels", "releases", "builds", "devices"]);
const PER_GROUP = 5;
const SCOPED_LIMIT = 50;

/** The palette's grouped, ranked results for the raw query and the chosen scope. */
export function usePaletteResults(raw: Ref<string>, chosen: Ref<SearchScope>) {
  const { appId, app } = useCurrentApp();
  const store = useCommandStore();
  const { recents } = storeToRefs(store);

  const parsed = computed(() => parseQuery(raw.value));
  const scope = computed<SearchScope>(() => parsed.value.scope ?? chosen.value);
  const term = computed(() => parsed.value.term);

  const { pages, appItems } = useNavigationItems();
  const catalog = useCatalogItems(appId);
  const actions = useActionItems();
  const devices = useDeviceHits(
    appId,
    term,
    computed(() => Boolean(app.value) && (scope.value === "all" || scope.value === "devices")),
  );

  const sources = computed<Record<ResultScope, SearchItem[]>>(() => ({
    pages: pages.value,
    apps: appItems.value,
    channels: app.value ? catalog.channels.value : [],
    releases: app.value ? catalog.releases.value : [],
    builds: app.value ? catalog.builds.value : [],
    devices: devices.items.value,
    actions: actions.value,
  }));

  const available = computed(() =>
    ORDER.filter((key) => Boolean(app.value) || !APP_SCOPES.has(key)),
  );

  const groups = computed<ResultGroup[]>(() => {
    const all = sources.value;
    if (!term.value && scope.value === "all") {
      const byId = new Map(ORDER.flatMap((key) => all[key]).map((item) => [item.id, item]));
      const recent = (Array.isArray(recents.value) ? recents.value : [])
        .map((id) => byId.get(id))
        .filter((item): item is SearchItem => item !== undefined);
      const shown = new Set(recent.map((item) => item.id));
      return [
        { key: "recent", label: "Recent", items: recent },
        { key: "pages", label: "Pages", items: all.pages.filter((item) => !shown.has(item.id)) },
        {
          key: "actions",
          label: "Actions",
          items: all.actions.filter((item) => !shown.has(item.id)),
        },
      ].filter((group) => group.items.length > 0);
    }
    const keys = scope.value === "all" ? ORDER : [scope.value];
    const limit = scope.value === "all" ? PER_GROUP : SCOPED_LIMIT;
    return keys
      .map((key) => ({
        key,
        label: SCOPE_LABELS[key],
        items: rankItems(all[key], term.value, limit).map((entry) => entry.item),
      }))
      .filter((group) => group.items.length > 0);
  });

  return {
    groups,
    scope,
    term,
    available,
    prefixed: computed(() => parsed.value.scope !== null),
    searchingDevices: devices.searching,
    deviceError: devices.error,
  };
}
