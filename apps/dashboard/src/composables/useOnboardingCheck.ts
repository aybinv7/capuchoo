import { useOrganizationsQuery } from '@/modules/organizations/composables/useOrganizationsQuery'

/**
 * Composable to check if user needs to complete onboarding
 * User needs onboarding if they have no organizations
 */
export const useOnboardingCheck = () => {
  const { data: organizations, isLoading, isFetched } = useOrganizationsQuery()

  const needsOnboarding = computed(() => {
    // Still loading - return null to indicate unknown state
    if (isLoading.value && !isFetched.value) return null
    // No organizations means user needs onboarding
    return !organizations.value || organizations.value.length === 0
  })

  const hasCompletedOnboarding = computed(() => {
    if (isLoading.value && !isFetched.value) return null
    return organizations.value && organizations.value.length > 0
  })

  return {
    needsOnboarding,
    hasCompletedOnboarding,
    isCheckingOnboarding: isLoading,
    organizations,
  }
}
