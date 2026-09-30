import { useQuery, type QueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import { queryKeys } from "../api/query-keys";
import { fetchMe } from "../services/session.service";

const SESSION_STALE_MS = 5 * 60_000;

export const sessionQueryOptions = {
  queryKey: queryKeys.me(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchMe(signal),
  staleTime: SESSION_STALE_MS,
  retry: false,
} as const;

/** Resolves the session for the router guard, from cache when it is fresh. */
export function ensureSession(client: QueryClient) {
  return client.ensureQueryData({ ...sessionQueryOptions, revalidateIfStale: true });
}

/** The signed-in user, their organizations and the apps they can reach (`GET /api/auth/me`). */
export function useSession() {
  const query = useQuery(sessionQueryOptions);
  const me = computed(() => query.data.value ?? null);
  return {
    ...query,
    me,
    user: computed(() => me.value?.user ?? null),
    organizations: computed(() => me.value?.organizations ?? []),
    apps: computed(() => me.value?.apps ?? []),
    isInstanceAdmin: computed(() => me.value?.user.role === "instance_admin"),
  };
}
