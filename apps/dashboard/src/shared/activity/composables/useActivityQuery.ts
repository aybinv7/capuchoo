import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { bucketFor, bucketKeys } from "@/shared/period/lib/buckets";
import type { ResolvedPeriod } from "@/shared/period/lib/period";
import { viewerZone } from "../lib/viewer-zone";
import type { Activity, ActivityView, ActivityWindow } from "../types";

export interface ActivityQueryOptions {
  /** The device or channel the counts belong to; a change of subject never shows the old chart. */
  subject: MaybeRefOrGetter<string>;
  period: MaybeRefOrGetter<ResolvedPeriod>;
  /** The cache key for one window of the current subject; the window must be its last element. */
  key: (subject: string, window: ActivityWindow) => readonly unknown[];
  fetch: (subject: string, window: ActivityWindow, signal: AbortSignal) => Promise<Activity>;
  enabled?: MaybeRefOrGetter<boolean>;
}

/**
 * Activity counts over a resolved period, hourly up to two days and daily beyond, cut in the
 * viewer's zone. While a new window of the same subject loads, the previous answer stays on screen.
 */
export function useActivityQuery(options: ActivityQueryOptions) {
  const tz = viewerZone();
  const request = computed(() => {
    const resolved = toValue(options.period);
    const window: ActivityWindow = {
      from: resolved.start.toISOString(),
      to: resolved.end.toISOString(),
      bucket: bucketFor(resolved),
      tz,
    };
    return { subject: toValue(options.subject), window };
  });

  return useQuery({
    queryKey: computed(() => options.key(request.value.subject, request.value.window)),
    queryFn: async ({ queryKey, signal }): Promise<ActivityView> => {
      const window = queryKey[queryKey.length - 1] as ActivityWindow;
      const subject = request.value.subject;
      const activity = await options.fetch(subject, window, signal);
      const span = { start: new Date(window.from), end: new Date(window.to) };
      return { ...activity, bucket: window.bucket, keys: bucketKeys(span, window.bucket) };
    },
    enabled: computed(
      () => Boolean(toValue(options.subject)) && (toValue(options.enabled) ?? true),
    ),
    placeholderData: (previous, previousQuery) => {
      const key = previousQuery?.queryKey;
      if (!key) return undefined;
      const current = options.key(toValue(options.subject), request.value.window);
      const sameSubject = JSON.stringify(key.slice(0, -1)) === JSON.stringify(current.slice(0, -1));
      return sameSubject ? keepPreviousData(previous) : undefined;
    },
  });
}
