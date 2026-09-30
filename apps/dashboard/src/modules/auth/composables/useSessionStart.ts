import { useQueryClient } from "@tanstack/vue-query";
import { useRoute, useRouter } from "vue-router";
import { ensureSession } from "@/shared/composables/useSession";
import { safeRedirect } from "@/shared/lib/redirect";

/**
 * After the server set the session cookie: drop anything cached under a previous identity, load the
 * new session, and continue to where the person was headed.
 */
export function useSessionStart() {
  const client = useQueryClient();
  const route = useRoute();
  const router = useRouter();

  return async function start() {
    client.clear();
    await ensureSession(client);
    await router.replace(safeRedirect(route.query.redirect, "/apps"));
  };
}
