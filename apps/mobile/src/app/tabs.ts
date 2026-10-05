import type { AppRole } from "@capuchoo/core";
import { can } from "@/shared/access/capabilities";

export interface TabDefinition {
  /** Also the tab's DOM id (`view-<id>`) and the first segment of its route. */
  id: "home" | "channels" | "builds" | "devices";
  /** i18n key, resolved in the shell so the label follows the active locale. */
  labelKey: string;
  /** Material ligature; the bar draws it filled when active and outlined otherwise. */
  iconMd: string;
  /** Whether a role sees the tab at all; the release desk is a developer's. */
  shows: (app: { role: AppRole; prod_role: AppRole }) => boolean;
}

/**
 * The app on screen, seen four ways; notifications and the account live in the top bar. A tester
 * or a viewer gets builds and devices only: what to install, and where it runs.
 */
export const tabs: TabDefinition[] = [
  { id: "home", labelKey: "tabs.home", iconMd: "space_dashboard", shows: can.seeReleases },
  { id: "channels", labelKey: "tabs.channels", iconMd: "layers", shows: can.seeReleases },
  { id: "builds", labelKey: "tabs.builds", iconMd: "inventory_2", shows: () => true },
  { id: "devices", labelKey: "tabs.devices", iconMd: "devices", shows: () => true },
];

export function tabsFor(app: { role: AppRole; prod_role: AppRole }): TabDefinition[] {
  return tabs.filter((tab) => tab.shows(app));
}
