export interface User {
  id: string
  email?: string
  full_name?: string
  avatar_url?: string
}

export interface Organization {
  id: string
  name: string
  created_at: string
  updated_at: string
  logo_url?: string
}

export type OrganizationRole = 'owner' | 'admin' | 'member'
export type AppRole = 'admin' | 'developer' | 'tester' | 'viewer'

export interface DynamicAppConfig {
  [key: string]: any
}

export interface App {
  id: string
  name: string
  app_id: string // bundle id
  organization_id: string
  user_id: string
  // user_role is injected by the backend helper 'get_user_apps'
  user_role?: AppRole | 'org_admin'
  platform: 'ios' | 'android' | 'web' | 'all'
  created_at: string
  updated_at: string
  icon_url?: string
  total_devices?: number
  total_bundles?: number
  config?: DynamicAppConfig
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: OrganizationRole
  created_at: string
  users?: User
}

export interface AppPermission {
  id: string
  app_id: string
  user_id: string
  role: AppRole
  created_at: string
  users?: User
}
