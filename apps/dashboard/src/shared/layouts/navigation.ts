import type { AppRole } from "@capuchoo/core";
import {
  Activity,
  Bug,
  ChartColumn,
  Clapperboard,
  Hammer,
  KeyRound,
  LayoutDashboard,
  Presentation,
  LayoutGrid,
  Package,
  Plug,
  RadioTower,
  ScrollText,
  Settings2,
  SlidersHorizontal,
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
  /** Shown to instance administrators only. */
  instanceAdmin?: boolean;
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

/** A count drawn beside a nav item, red when it needs someone. */
export interface NavBadge {
  count: number;
  urgent: boolean;
  label: string;
}

export const APP_NAVIGATION: NavGroup[] = [
  {
    label: "App",
    items: [
      {
        name: RouteName.overview,
        label: "Overview",
        icon: LayoutDashboard,
        keywords: ["home", "summary", "health", "attention", "dashboard"],
      },
    ],
  },
  {
    label: "Release",
    items: [
      {
        name: RouteName.canvas,
        label: "Canvas",
        icon: Workflow,
        keywords: ["pipeline", "deliver", "graph"],
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
        keywords: ["ci", "gitlab", "github", "pipeline", "deploy", "run", "actions"],
      },
    ],
  },
  {
    label: "Session replay",
    items: [
      {
        name: RouteName.recordings,
        label: "Sessions",
        icon: Clapperboard,
        also: [RouteName.recording, RouteName.recordingAssist],
        keywords: [
          "replay",
          "recordings",
          "rrweb",
          "shake",
          "report",
          "console",
          "network",
          "live",
          "assist",
        ],
      },
      {
        name: RouteName.recordingIssues,
        label: "Errors",
        icon: Bug,
        keywords: ["issues", "crashes", "exceptions", "regressions", "stack"],
      },
      {
        name: RouteName.recordingRules,
        label: "Recorder",
        icon: SlidersHorizontal,
        children: [
          { name: RouteName.recordingRules, label: "What devices record" },
          { name: RouteName.recordingSetup, label: "Connect and health" },
        ],
        keywords: ["rules", "policy", "buffer", "sampling", "setup", "health", "go live"],
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
        also: [RouteName.device],
        keywords: ["installations", "map", "tablets", "attributes", "user"],
      },
      {
        name: RouteName.activity,
        label: "Activity",
        icon: Activity,
        keywords: ["events", "telemetry", "deliveries", "failures", "checks", "logs"],
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
          { name: RouteName.appCi, label: "CI" },
          { name: RouteName.appConfig, label: "Remote config" },
        ],
        keywords: ["configuration", "members", "keys", "identifiers", "github", "gitlab", "ci"],
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
      {
        name: RouteName.githubApp,
        label: "GitHub App",
        icon: Plug,
        keywords: ["github", "ci", "actions", "integration", "installation"],
      },
      {
        name: RouteName.demo,
        label: "Demo",
        icon: Presentation,
        instanceAdmin: true,
        keywords: ["demo", "sample", "seed", "northwind", "presentation"],
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

export function navItemVisible(
  item: NavItem,
  role: AppRole | null | undefined,
  instanceAdmin = false,
): boolean {
  if (item.instanceAdmin && !instanceAdmin) return false;
  return !item.minRole || hasAppRole(role, item.minRole);
}
