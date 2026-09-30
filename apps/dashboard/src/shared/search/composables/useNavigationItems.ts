import { AppWindow } from "@lucide/vue";
import { computed } from "vue";
import { useCurrentApp } from "../../composables/useCurrentApp";
import { useSession } from "../../composables/useSession";
import {
  APP_NAVIGATION,
  WORKSPACE_NAVIGATION,
  navItemVisible,
  type NavGroup,
} from "../../layouts/navigation";
import { RouteName } from "../../router/route-names";
import type { SearchItem } from "../types";

function pagesOf(
  groups: readonly NavGroup[],
  params: Record<string, string> | undefined,
  scopeLabel: string | null,
  visible: (item: NavGroup["items"][number]) => boolean,
): SearchItem[] {
  return groups.flatMap((group) =>
    group.items.filter(visible).flatMap((item) => {
      const where = scopeLabel ? `${scopeLabel} · ${group.label}` : group.label;
      const page: SearchItem = {
        id: `page:${item.name}`,
        scope: "pages",
        label: item.label,
        hint: where,
        icon: item.icon,
        keywords: item.keywords,
        to: { name: item.name, params },
      };
      const children = (item.children ?? [])
        .filter((child) => child.name !== item.name)
        .map<SearchItem>((child) => ({
          id: `page:${child.name}`,
          scope: "pages",
          label: `${item.label}: ${child.label}`,
          hint: where,
          icon: item.icon,
          keywords: item.keywords,
          to: { name: child.name, params },
        }));
      return [page, ...children];
    }),
  );
}

/** Every page the viewer can open, and every app they can switch to. */
export function useNavigationItems() {
  const { app, role } = useCurrentApp();
  const { apps, organizations } = useSession();

  const pages = computed<SearchItem[]>(() => {
    const current = app.value;
    const inApp = current
      ? pagesOf(APP_NAVIGATION, { appId: current.id }, current.name, (item) =>
          navItemVisible(item, role.value),
        )
      : [];
    return [...inApp, ...pagesOf(WORKSPACE_NAVIGATION, undefined, null, () => true)];
  });

  const appItems = computed<SearchItem[]>(() => {
    const names = new Map(organizations.value.map((org) => [org.id, org.name]));
    return apps.value
      .filter((entry) => entry.id !== app.value?.id)
      .map((entry) => ({
        id: `app:${entry.id}`,
        scope: "apps",
        label: entry.name,
        hint: [names.get(entry.organization_id), entry.app_id].filter(Boolean).join(" · "),
        keywords: [entry.app_id, entry.role ?? ""],
        icon: AppWindow,
        to: { name: RouteName.canvas, params: { appId: entry.id } },
      }));
  });

  return { pages, appItems };
}
