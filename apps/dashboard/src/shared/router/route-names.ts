/**
 * Route names are the contract between modules: a module links to another page by name, never by
 * importing it. Each module registers the routes it owns under these names.
 */
export const RouteName = {
  login: "login",
  invite: "invite",
  apps: "apps",
  account: "settings-account",
  apiKeys: "settings-api-keys",
  organization: "settings-organization",
  githubApp: "settings-github",
  demo: "settings-demo",
  canvas: "app-canvas",
  channels: "app-channels",
  channel: "app-channel",
  releases: "app-releases",
  devices: "app-devices",
  device: "app-device",
  activity: "app-activity",
  statistics: "app-statistics",
  builds: "app-builds",
  build: "app-build",
  audit: "app-audit",
  appGeneral: "app-settings-general",
  appPermissions: "app-settings-permissions",
  appSigning: "app-settings-signing",
  appCi: "app-settings-ci",
  appConfig: "app-settings-config",
  notFound: "not-found",
} as const;

export type RouteNameValue = (typeof RouteName)[keyof typeof RouteName];
