import type { Organization, App } from '@/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { onboardingService, type OnboardingPayload } from '@/services/onboarding.service'

export const useOnboardingStore = defineStore(
  'onboarding',
  () => {
    // FORM STATE (Draft data to be submitted)
    const organizationData = ref<{ name: string }>({ name: '' })
    const appData = ref<{ name: string; platform: string }>({ name: '', platform: '' })

    // RESULT STATE (Populated after successful submission)
    const currentOrganization = ref<Organization | null>(null)
    const currentApp = ref<App | null>(null)

    // Additional state for steps (Invite, Channels)
    const members = ref<{ email: string; role: 'viewer' | 'editor' | 'admin' }[]>([])
    const channels = ref<string[]>(['Production'])

    const loading = ref(false)
    const error = ref<string | null>(null)

    // ACTIONS
    function setOrganizationDraft(name: string) {
      organizationData.value = { name }
    }

    function setAppDraft(name: string, platform: string) {
      appData.value = { name, platform }
    }

    async function submitOnboarding() {
      loading.value = true
      error.value = null

      try {
        const payload: OnboardingPayload = {
          organization: organizationData.value,
          app: appData.value,
        }

        const response = await onboardingService.complete(payload)

        // Update state with created entities
        currentOrganization.value = response.organization
        currentApp.value = response.app

        return response
      } catch (err: any) {
        console.error('Onboarding submission failed:', err)
        error.value = err.message || 'Failed to complete onboarding'
        throw err
      } finally {
        loading.value = false
      }
    }

    // Reset state
    function reset() {
      organizationData.value = { name: '' }
      appData.value = { name: '', platform: '' }
      currentOrganization.value = null
      currentApp.value = null
      error.value = null
      loading.value = false
    }

    return {
      // State
      organizationData,
      appData,
      currentOrganization,
      currentApp,
      members,
      channels,
      loading,
      error,

      // Actions
      setOrganizationDraft,
      setAppDraft,
      submitOnboarding,
      reset,
    }
  },
  {
    persist: true,
  },
)
