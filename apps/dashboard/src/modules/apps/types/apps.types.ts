// Re-export from shared models to ensure consistency
export type { App } from '@/types/models'

export interface CreateAppInput {
  app_id: string
  name: string
  organization_id: string
  platform?: 'ios' | 'android' | 'web' | 'all'
  icon_url?: string
}

export interface UpdateAppInput {
  name?: string
  platform?: 'ios' | 'android' | 'web' | 'all'
  icon_url?: string
}
