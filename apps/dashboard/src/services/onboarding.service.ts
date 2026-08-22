export interface OnboardingPayload {
  organization: {
    name: string;
  };
  app: {
    name: string;
    /**
     * The real bundle identifier, e.g. com.company.app. The server used to
     * derive this from the display name, which produced ids no device sends.
     */
    appId: string;
    platform: string;
  };
}

export interface OnboardingResponse {
  organization: Organization;
  app: App;
  /** A staging channel, created so the app is deployable straight away. */
  channel: { id: string; name: string; environment: string } | null;
}

export const onboardingService = {
  async complete(payload: OnboardingPayload): Promise<OnboardingResponse> {
    const response = await apiClient.post<OnboardingResponse>("/onboarding", payload);
    return response.data;
  },
};
