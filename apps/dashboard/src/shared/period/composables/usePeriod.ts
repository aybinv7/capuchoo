import { computed, onScopeDispose, toValue, type MaybeRefOrGetter } from "vue";
import { useRoute, useRouter, type LocationQuery } from "vue-router";
import { useNow } from "../../composables/useNow";
import { dayKey, parseDayKey } from "../lib/local-day";
import {
  isSamePeriod,
  parsePeriod,
  periodBounds,
  periodQuery,
  resolvePeriod,
  type Period,
} from "../lib/period";

const PERIOD_KEYS = ["range", "from", "to"] as const;

/**
 * The period a page shows, kept in the URL (`?range=30d`, `?from=…&to=…`) so it survives a reload
 * and can be shared. "Today" follows the shared clock, so an open page rolls over at midnight.
 */
export function usePeriod(retentionDays: MaybeRefOrGetter<number | null | undefined>) {
  const route = useRoute();
  const router = useRouter();
  const clock = useNow();
  onScopeDispose(clock.release);

  const today = computed(() => dayKey(new Date(clock.now.value)));
  const now = computed(() => parseDayKey(today.value) ?? new Date());
  const retention = computed(() => toValue(retentionDays) ?? null);
  const period = computed(() => parsePeriod(route.query));
  const resolved = computed(() => resolvePeriod(period.value, now.value, retention.value));
  const bounds = computed(() => periodBounds(period.value, resolved.value));

  function setPeriod(next: Period) {
    if (isSamePeriod(next, period.value)) return;
    const query: LocationQuery = { ...route.query };
    for (const key of PERIOD_KEYS) delete query[key];
    void router.replace({ query: { ...query, ...periodQuery(next) } });
  }

  return { period, resolved, bounds, retention, now, setPeriod };
}
