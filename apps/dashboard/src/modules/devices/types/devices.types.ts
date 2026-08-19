export interface Device {
  id: string
  device_id: string
  app_id?: string
  platform: 'android' | 'ios'
  channel?: string
  custom_channel?: string // If overridden
  current_bundle_id?: string
  current_native_id?: string
  last_check?: string
  created_at?: string
  updated_at?: string
  latitude?: number
  longitude?: number
  // Version tracking
  version_name?: string // Current OTA bundle version
  version_build?: string // Native app version (e.g., "1.0.0")
  version_code?: string // Native build number (e.g., "54")
  version_os?: string // OS version
  // Plugin info
  plugin_version?: string // Capgo plugin version
  is_emulator?: boolean
  is_prod?: boolean
  // Stats
  last_stats_action?: string // Last action (first_open, app_moved_to_foreground, etc.)
  last_stats_at?: string // Timestamp of last stats event
}
