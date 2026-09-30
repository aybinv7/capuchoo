import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useWorkspaceStore } from "../stores/workspace.store";
import { useCurrentApp } from "./useCurrentApp";
import { useSession } from "./useSession";

/**
 * The organization in view: the current app's when an app is open, otherwise the one the person
 * picked, otherwise their first.
 */
export function useCurrentOrganization() {
  const { organizations } = useSession();
  const { app } = useCurrentApp();
  const store = useWorkspaceStore();
  const { organizationId } = storeToRefs(store);

  const organization = computed(() => {
    const list = organizations.value;
    const wanted = app.value?.organization_id ?? organizationId.value;
    return list.find((org) => org.id === wanted) ?? list[0] ?? null;
  });

  return {
    organization,
    organizations,
    role: computed(() => organization.value?.role ?? null),
    select: store.selectOrganization,
  };
}
