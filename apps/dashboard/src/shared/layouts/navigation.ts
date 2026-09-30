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
import { RouteName, type RouteNameValue } from "../router/route-names";

export interface NavItem {
  name: RouteNameValue;
  label: string;
  icon: Component;
  minRole?: AppRole;
  /** Other route names that keep this item highlighted. */
  also?: RouteNameValue[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const APP_NAVIGATION: NavGroup[] = [
  {
    label: "Release",
    items: [
      { name: RouteName.canvas, label: "Canvas", icon: Workflow },
      { name: RouteName.channels, label: "Channels", icon: RadioTower, also: [RouteName.channel] },
      { name: RouteName.releases, label: "Releases", icon: Package },
      { name: RouteName.builds, label: "Builds", icon: Hammer, also: [RouteName.build] },
    ],
  },
  {
    label: "Fleet",
    items: [
      { name: RouteName.devices, label: "Devices", icon: Smartphone },
      { name: RouteName.statistics, label: "Statistics", icon: ChartColumn },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: RouteName.audit, label: "Audit log", icon: ScrollText, minRole: "admin" },
      {
        name: RouteName.appGeneral,
        label: "App settings",
        icon: Settings2,
        also: [
          RouteName.appPermissions,
          RouteName.appSigning,
          RouteName.appGitlab,
          RouteName.appConfig,
        ],
      },
    ],
  },
];

export const WORKSPACE_NAVIGATION: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { name: RouteName.apps, label: "Apps", icon: LayoutGrid },
      { name: RouteName.organization, label: "Organization", icon: Users },
    ],
  },
  {
    label: "Account",
    items: [
      { name: RouteName.account, label: "Profile", icon: UserRound },
      { name: RouteName.apiKeys, label: "API keys", icon: KeyRound },
    ],
  },
];
