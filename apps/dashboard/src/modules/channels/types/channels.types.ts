export interface Channel {
  id: string
  name: string
  app_id: string
  environment: 'prod' | 'staging' | 'dev'
  is_public: boolean
  allow_device_self_set: boolean
  allow_dev: boolean
  allow_emulator: boolean
  ios_enabled: boolean
  android_enabled: boolean
  disable_auto_update: 'none' | 'major' | 'minor' | 'patch'
  disable_auto_update_under_native: boolean
  current_version_id?: string
  current_native_version_id?: string
  current_version?: string
  created_at: string
  updated_at: string
  bundle_count?: number
  device_count?: number
}
