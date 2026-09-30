import { useStorage } from "@vueuse/core";
import { defineStore } from "pinia";

/** The organization the person is looking at. Persisted as a preference; it grants nothing. */
export const useWorkspaceStore = defineStore("workspace", () => {
  const organizationId = useStorage<string | null>("capuchoo.organization", null);

  function selectOrganization(id: string | null) {
    organizationId.value = id;
  }

  return { organizationId, selectOrganization };
});
