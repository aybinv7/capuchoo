import { apiClient } from './api.client'
import type { Organization, OrganizationMember } from '@/types/models'

export interface CreateOrganizationDto {
  name: string
}

export const organizationService = {
  async getAll() {
    const response = await apiClient.get<Organization[]>('/organizations')
    return response.data
  },

  async getById(id: string) {
    const response = await apiClient.get<Organization>(`/organizations/${id}`)
    return response.data
  },

  async create(data: CreateOrganizationDto) {
    const response = await apiClient.post<Organization>('/organizations', data)
    return response.data
  },

  async update(id: string, data: Partial<CreateOrganizationDto>) {
    const response = await apiClient.put<Organization>(`/organizations/${id}`, data)
    return response.data
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/organizations/${id}`)
    return response.data
  },

  async getMembers(id: string) {
    const response = await apiClient.get<OrganizationMember[]>(`/organizations/${id}/members`)
    return response.data
  },

  async addMember(id: string, email: string, role: string) {
    const response = await apiClient.post<OrganizationMember>(`/organizations/${id}/members`, {
      email,
      role,
    })
    return response.data
  },

  async updateMemberRole(id: string, userId: string, role: string) {
    const response = await apiClient.put<OrganizationMember>(
      `/organizations/${id}/members/${userId}`,
      { role },
    )
    return response.data
  },

  async removeMember(id: string, userId: string) {
    const response = await apiClient.delete(`/organizations/${id}/members/${userId}`)
    return response.data
  },
}
