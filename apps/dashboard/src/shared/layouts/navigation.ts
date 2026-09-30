import type { AppRole } from "@capuchoo/core";
import {
  ChartColumn,
  Hammer,
  KeyRound,
  LayoutGrid,
  Package,
  RadioTower,
  ScrollText,
  Settings2,
  Smartphone,
  UserRound,
  Users,
  Workflow,
} from "@lucide/vue";
import type { Component } from "vue";
import { hasAppRole } from "../lib/roles";
import { RouteName, type RouteNameValue } from "../router/route-names";

export interface NavChild {
  name: RouteNameValue;
  label: string;
}

export interface NavItem {
  name: RouteNameValue;
  label: string;
  icon: Component;
  minRole?: AppRole;
  /** Other route names that keep this item highlighted. */
  also?: RouteNameValue[];
  /** Sub-pages, shown as a collapsible list under the item. */
  children?: NavChild[];
  /** Extra words the command palette matches. */
  keywords?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const APP_NAVIGATION: NavGroup[] = [
  {
    label: "Release",
    items: [
      {
        name: RouteName.canvas,
        label: "Canvas",
        icon: Workflow,
        keywords: ["overview", "pipeline", "deliver"],
      },
      {
        name: RouteName.channels,
        label: "Channels",
        icon: RadioTower,
        also: [RouteName.channel],
        keywords: ["pointer", "client", "pause", "rollback"],
      },
      {
        name: RouteName.releases,
        label: "Releases",
        icon: Package,
        keywords: ["bundles", "ota", "native", "apk", "artefacts"],
      },
      {
        name: RouteName.builds,
        label: "Builds",
        icon: Hammer,
        also: [RouteName.build],
        keywords: ["ci", "gitlab", "pipeline", "deploy"],
      },
    ],
  },
  {
    label: "Fleet",
    items: [
      {
        name: RouteName.devices,
        label: "Devices",
        icon: Smartphone,
        keywords: ["installations", "map", "tablets"],
      },
      {
        name: RouteName.statistics,
        label: "Statistics",
        icon: ChartColumn,
        keywords: ["adoption", "failures", "stats", "analytics"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        name: RouteName.audit,
        label: "Audit log",
        icon: ScrollText,
        minRole: "admin",
        keywords: ["history", "who", "changes"],
      },
      {
        name: RouteName.appGeneral,
        label: "App settings",
        icon: Settings2,
        children: [
          { name: RouteName.appGeneral, label: "General" },
          { name: RouteName.appPermissions, label: "Access" },
          { name: RouteName.appSigning, label: "Signing" },
          { name: RouteName.appGitlab, label: "GitLab" },
          { name: RouteName.appConfig, label: "Remote config" },
        ],
        keywords: ["configuration", "members", "keys", "identifiers"],
      },
    ],
  },
];

export const WORKSPACE_NAVIGATION: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { name: RouteName.apps, label: "Apps", icon: LayoutGrid, keywords: ["projects"] },
      {
        name: RouteName.organization,
        label: "Organization",
        icon: Users,
        keywords: ["members", "invite", "team"],
      },
    ],
  },
  {
    label: "Account",
    items: [
      { name: RouteName.account, label: "Profile", icon: UserRound, keywords: ["password"] },
      { name: RouteName.apiKeys, label: "API keys", icon: KeyRound, keywords: ["token", "cli"] },
    ],
  },
];

export function navItemVisible(item: NavItem, role: AppRole | null | undefined): boolean {
  return !item.minRole || hasAppRole(role, item.minRole);
}
