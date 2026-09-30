import type { ChannelHealth } from "./release";

export interface DailyActivity {
  day: string;
  checks: number;
  installs: number;
  failures: number;
  devices: number;
}

export interface VersionShare {
  version: string;
  platform: string;
  devices: number;
}

export interface ChannelStats extends ChannelHealth {
  name: string | null;
}

/** `GET /api/apps/:id/stats?days=`. */
export interface AppStats {
  days: number;
  totals: {
    checks: number;
    installs: number;
    failures: number;
    devices: number;
    active_24h: number;
    success_rate: number | null;
  };
  daily: DailyActivity[];
  versions: VersionShare[];
  channels: ChannelStats[];
}
