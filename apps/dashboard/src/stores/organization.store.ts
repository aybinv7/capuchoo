import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Organization } from '@/types/models'

export const useOrganizationStore = defineStore('organization', () => {
  const activeOrganization = ref<Organization | null>(null)

  // Initialize from localStorage
  const init = () => {
    const stored = localStorage.getItem('active_organization')
    if (stored) {
      try {
        activeOrganization.value = JSON.parse(stored)
      } catch {
        localStorage.removeItem('active_organization')
      }
    }
  }

  // Persist to localStorage
  watch(activeOrganization, (newVal) => {
    if (newVal) {
      localStorage.setItem('active_organization', JSON.stringify(newVal))
    } else {
      localStorage.removeItem('active_organization')
    }
  })

  // Set active organization
  const setActiveOrganization = (org: Organization | null) => {
    activeOrganization.value = org
  }

  // Initialize on store creation
  init()

  return {
    activeOrganization,
    setActiveOrganization,
  }
})
