import { useApiQuery } from "../composables/api/useApiQuery";
import type { Organization, App } from "../types/models";
import type { MaybeRefOrGetter } from "vue";

export const ORGS_KEY = "organizations";
export const APPS_KEY = "apps";

export function useOrganizationsQuery() {
  return useApiQuery<Organization[]>([ORGS_KEY], "/organizations");
}

export function useAppsQuery(
  organizationId: MaybeRefOrGetter<string | undefined>,
) {
  return useApiQuery<App[]>(
    computed(() => [APPS_KEY, toValue(organizationId)]),
    computed(() => `/apps?organization_id=${toValue(organizationId)}`),
    {
      enabled: computed(() => !!toValue(organizationId)),
    },
  );
}
