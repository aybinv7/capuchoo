export interface Bundle {
  id: string
  platform: 'android' | 'ios' | 'web'
  version_name: string
  download_url: string
  checksum?: string
  session_key?: string
  channel: 'prod' | 'staging' | 'dev'
  required: boolean
  active: boolean
  created_at: string
  created_by?: string
  min_native_version?: number // Minimum native build version required
  release_notes?: string
  is_active_for?: string[]
}

export interface NativeUpdate {
  id: string
  platform: 'android' | 'ios'
  version_name: string
  version_code: number
  download_url: string
  checksum?: string
  channel: 'prod' | 'staging' | 'dev'
  required: boolean
  active: boolean
  created_at: string
  created_by?: string
  file_size_bytes?: number
  release_notes?: string
  is_active_for?: string[]
}

export interface UpdateOrBundle {
  id: string
  type: 'bundle' | 'native'
  platform: 'android' | 'ios' | 'web'
  version_name: string
  version_code?: number // Only for native updates
  download_url: string
  checksum?: string
  session_key?: string // Only for bundles
  channel: 'prod' | 'staging' | 'dev'
  required: boolean
  active: boolean
  created_at: string
  created_by?: string
  file_size_bytes?: number // Only for native updates
  release_notes?: string
  min_native_version?: number // Only for OTA bundles
  app_id: string
  app_bundle_id?: string
  is_active_for?: string[]
}

export type BulkEditData = {
  channel?: string
  required?: string
  active?: string
}
