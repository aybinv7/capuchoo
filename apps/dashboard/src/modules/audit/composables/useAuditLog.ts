import { useInfiniteQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { AUDIT_PAGE_SIZE, fetchAudit } from "../services/audit.service";

/** The app's audit log, newest first, paged backwards by id. */
export function useAuditLog(appId: MaybeRefOrGetter<string>) {
  const query = useInfiniteQuery({
    queryKey: computed(() => queryKeys.audit(toValue(appId))),
    queryFn: ({ pageParam, signal }) => fetchAudit(toValue(appId), pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.length < AUDIT_PAGE_SIZE ? undefined : last[last.length - 1]?.id,
    enabled: computed(() => Boolean(toValue(appId))),
  });
  return { ...query, entries: computed(() => query.data.value?.pages.flat() ?? []) };
}
