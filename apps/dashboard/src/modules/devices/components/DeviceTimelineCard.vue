<script setup lang="ts">
import { History } from "@lucide/vue";
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { useDeviceEvents } from "../composables/useDeviceEvents";
import { EVENT_FILTERS, isEventFilter } from "../lib/event-filters";
import type { EventBounds, EventFilter } from "../types/devices.types";
import EventFilterChips from "./EventFilterChips.vue";
import EventTimeline from "./EventTimeline.vue";

const props = defineProps<{ appId: string; deviceId: string; bounds: EventBounds }>();

const filter = useQueryParam<EventFilter>("events", "all", isEventFilter);
const feed = useDeviceEvents(
  () => props.appId,
  () => props.deviceId,
  filter,
  () => props.bounds,
);
const filterLabel = computed(
  () => EVENT_FILTERS.find((option) => option.value === filter.value)?.label.toLowerCase() ?? "",
);
const windowed = computed(() => Boolean(props.bounds.from || props.bounds.to));
const emptyText = computed(() => {
  const scope = windowed.value ? "in this period" : "in the kept history";
  if (filter.value !== "all") return `No ${filterLabel.value} event ${scope}.`;
  return windowed.value
    ? "No event in this period. Pick a wider one above."
    : "No event in the kept history. Events appear as the app checks for and installs updates.";
});
</script>

<template>
  <section class="bg-card min-w-0 rounded-lg border">
    <header
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5"
    >
      <span class="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase">
        <History class="size-3.5" />
        Timeline
        <Spinner
          v-if="feed.isFetching.value && !feed.isPending.value"
          class="size-3"
          aria-label="Refreshing"
        />
      </span>
      <EventFilterChips v-model="filter" />
    </header>
    <div class="p-4">
      <ErrorNotice v-if="feed.error.value" :error="feed.error.value" :retry="feed.refetch" />
      <div v-else-if="feed.isPending.value" class="space-y-3" aria-busy="true">
        <Skeleton v-for="index in 6" :key="index" class="h-9 w-full" />
      </div>
      <p
        v-else-if="feed.events.value.length === 0"
        class="text-muted-foreground py-6 text-center text-sm text-pretty"
      >
        {{ emptyText }}
      </p>
      <EventTimeline
        v-else
        :events="feed.events.value"
        :has-more="feed.hasMore.value"
        :loading-older="feed.loadingOlder.value"
        :older-error="feed.olderError.value"
        :collapse-checks="filter !== 'check'"
        @load-older="feed.loadOlder"
        @retry-older="feed.retryOlder"
      />
    </div>
  </section>
</template>
