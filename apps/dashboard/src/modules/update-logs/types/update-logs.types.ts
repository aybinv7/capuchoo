export interface UpdateLog {
  id: string
  device_id: string
  app_id: string
  action:
    | 'get'
    | 'download'
    | 'download_fail'
    | 'install'
    | 'install_fail'
    | 'set'
    | 'first_open'
    | 'app_moved_to_foreground'
    | 'app_moved_to_background'
  current_version?: string
  new_version?: string
  platform: 'android' | 'ios'
  timestamp: string
  ip?: string
  user_agent?: string
}
