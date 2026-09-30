/**
 * Every TanStack Query key in one place. App-scoped data lives under `["apps", appId, ...]` so a
 * stream reconnect can invalidate one prefix; entity keys (`channels`, `builds`) are addressed by id
 * because the live stream names entities by id.
 */
export const queryKeys = {
  me: () => ["me"] as const,
  app: (appId: string) => ["apps", appId] as const,
  appDetail: (appId: string) => ["apps", appId, "detail"] as const,
  catalog: (appId: string) => ["apps", appId, "catalog"] as const,
  stats: (appId: string, days: number) => ["apps", appId, "stats", days] as const,
  statsAll: (appId: string) => ["apps", appId, "stats"] as const,
  builds: (appId: string) => ["apps", appId, "builds"] as const,
  devicesAll: (appId: string) => ["apps", appId, "devices"] as const,
  devices: (appId: string, filters: Record<string, unknown>) =>
    ["apps", appId, "devices", filters] as const,
  audit: (appId: string) => ["apps", appId, "audit"] as const,
  appSettings: (appId: string, section: string) => ["apps", appId, "settings", section] as const,
  channel: (channelId: string) => ["channels", channelId] as const,
  channelHistory: (channelId: string) => ["channels", channelId, "history"] as const,
  channelServed: (channelId: string) => ["channels", channelId, "served"] as const,
  build: (buildId: string) => ["builds", buildId] as const,
  apiKeys: () => ["api-keys"] as const,
  organization: (organizationId: string, section: string) =>
    ["organizations", organizationId, section] as const,
  invitation: (token: string) => ["invitation", token] as const,
};
