/** Shapes returned by `/dashboard/stats` and `/dashboard/stats-data`. */

export type UpdateEventCategory =
  | "delivered"
  | "downloading"
  | "failed"
  | "check"
  | "lifecycle"
  | "cancelled"
  | "other";

export interface EventSummary {
  delivered: number;
  downloading: number;
  failed: number;
  check: number;
  lifecycle: number;
  cancelled: number;
  other: number;
  total: number;
}

export interface DashboardStats {
  bundles_count: number;
  devices_count: number;
  channels_count: number;
  downloads_count: number;
  /** null when nothing has been attempted - not 100%, and not a made-up 98.5%. */
  success_rate?: number | null;
  events?: EventSummary;
}

export interface StatsDataPoint {
  date: string;
  count: number;
}

export interface ActionBreakdown {
  action: string;
  count: number;
  category: UpdateEventCategory;
}

export interface DashboardStatsData {
  downloads: StatsDataPoint[];
  failures: StatsDataPoint[];
  active_users: StatsDataPoint[];
  by_platform: Array<{ platform: string; count: number }>;
  by_channel: Array<{ channel: string; count: number }>;
  by_action: ActionBreakdown[];
  summary: EventSummary;
  success_rate: number | null;
  range: string;
}
