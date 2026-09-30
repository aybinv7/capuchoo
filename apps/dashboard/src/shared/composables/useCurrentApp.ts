import { computed } from "vue";
import { useRoute } from "vue-router";
import type { ProdRole } from "../types/session";
import { useSession } from "./useSession";

/** The app named by the `:appId` route parameter, and the caller's standing on it. */
export function useCurrentApp() {
  const route = useRoute();
  const { apps, organizations } = useSession();

  const appId = computed(() => {
    const value = route.params.appId;
    return typeof value === "string" ? value : "";
  });
  const app = computed(() => apps.value.find((entry) => entry.id === appId.value) ?? null);
  const role = computed(() => app.value?.role ?? null);
  const prodRole = computed<ProdRole>(() => app.value?.prod_role ?? "admin");
  const organization = computed(
    () => organizations.value.find((org) => org.id === app.value?.organization_id) ?? null,
  );

  return {
    appId,
    app,
    role,
    prodRole,
    organization,
    orgRole: computed(() => organization.value?.role ?? null),
  };
}
