export interface DashboardStats {
  bundles_count: number
  devices_count: number
  channels_count: number
  downloads_count: number
  active_users_count?: number
  total_revenue?: string // Kept for compatibility with current UI if needed, though API might not return it
}

export interface StatsDataPoint {
  date: string
  count: number
}

export interface DashboardStatsData {
  downloads: StatsDataPoint[]
  active_users: StatsDataPoint[]
}
