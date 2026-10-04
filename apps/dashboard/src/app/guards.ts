import type { QueryClient } from "@tanstack/vue-query";
import type { Router } from "vue-router";
import { toast } from "vue-sonner";
import { isApiError } from "@/shared/api/errors";
import { onUnauthorized } from "@/shared/api/http";
import { ensureSession } from "@/shared/composables/useSession";
import { hasAppRole } from "@/shared/lib/roles";
import { RouteName } from "@/shared/router/route-names";

const TITLE = "Capuchoo";

/**
 * Every non-public route needs a session (`GET /api/auth/me`, cached). A 401 goes to sign-in with
 * the destination kept; other failures let the shell render its own error. Role-gated routes fall
 * back to the app's canvas: hiding a page is a courtesy, the server still refuses the data.
 */
export function installGuards(router: Router, client: QueryClient): void {
  router.beforeEach(async (to) => {
    if (to.meta.public) return true;
    try {
      const me = await ensureSession(client);
      if (to.meta.instanceAdmin && me.user.role !== "instance_admin") {
        toast.warning("That page is for instance administrators.");
        return { name: RouteName.apps };
      }
      const appId = typeof to.params.appId === "string" ? to.params.appId : null;
      if (!appId) return true;
      const app = me.apps.find((entry) => entry.id === appId);
      if (!app) return true;
      const required = [...to.matched].reverse().find((record) => record.meta.minRole)
        ?.meta.minRole;
      if (required && !hasAppRole(app.role, required)) {
        toast.warning(`That page requires the ${required} role on ${app.name}.`);
        return { name: RouteName.overview, params: { appId } };
      }
      return true;
    } catch (error) {
      if (isApiError(error) && error.status === 401)
        return { name: RouteName.login, query: { redirect: to.fullPath } };
      return true;
    }
  });

  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · ${TITLE}` : TITLE;
  });

  onUnauthorized(() => {
    const current = router.currentRoute.value;
    if (current.meta.public || current.matched.length === 0) return;
    client.clear();
    void router.replace({ name: RouteName.login, query: { redirect: current.fullPath } });
  });
}
