import { apiClient } from './api.client'
import type { App, DynamicAppConfig } from '@/types/models'

export interface CreateAppDto {
  name: string
  app_id: string
  organization_id: string
  platform?: 'ios' | 'android' | 'web' | 'all'
  icon_url?: string
  config?: DynamicAppConfig
}

export const appService = {
  async getAll(organizationId?: string) {
    const params: any = {}
    if (organizationId) params.organization_id = organizationId

    const response = await apiClient.get<App[]>('/apps', { params })
    return response.data
  },

  async getById(id: string) {
    const response = await apiClient.get<App>(`/apps/${id}`)
    return response.data
  },

  async create(data: CreateAppDto) {
    const response = await apiClient.post<App>('/apps', data)
    return response.data
  },

  async update(id: string, data: Partial<CreateAppDto>) {
    const response = await apiClient.put<App>(`/apps/${id}`, data)
    return response.data
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/apps/${id}`)
    return response.data
  },

  async getPermissions(id: string) {
    const response = await apiClient.get<any[]>(`/apps/${id}/permissions`)
    return response.data
  },

  async setPermission(appId: string, userId: string, role: string) {
    const response = await apiClient.post(`/apps/${appId}/permissions`, {
      user_id: userId,
      role,
    })
    return response.data
  },

  async removePermission(appId: string, userId: string) {
    const response = await apiClient.delete(`/apps/${appId}/permissions/${userId}`)
    return response.data
  },
}
