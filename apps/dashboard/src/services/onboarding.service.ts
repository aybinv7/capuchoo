export interface OnboardingPayload {
  organization: {
    name: string
  }
  app: {
    name: string
    platform: string
  }
}

export interface OnboardingResponse {
  organization: Organization
  app: App
}

export const onboardingService = {
  async complete(payload: OnboardingPayload): Promise<OnboardingResponse> {
    const response = await apiClient.post<OnboardingResponse>('/onboarding', payload)
    return response.data
  },
}
