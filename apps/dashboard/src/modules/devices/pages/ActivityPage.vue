<script setup lang="ts">
import { Activity } from "@lucide/vue";
import { computed } from "vue";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { orderChannels } from "@/shared/lib/channels";
import { useCatalog } from "@/shared/queries/useCatalog";
import ActivityDeviceLink from "../components/ActivityDeviceLink.vue";
import EventFilterChips from "../components/EventFilterChips.vue";
import EventTimeline from "../components/EventTimeline.vue";
import { useActivityFeed } from "../composables/useActivityFeed";
import { EVENT_FILTERS, isEventFilter } from "../lib/event-filters";
import type { ActivityFilters, EventFilter } from "../types/devices.types";

const { appId } = useCurrentApp();
const { channels } = useCatalog(appId);
const category = useQueryParam<EventFilter>("category", "all", isEventFilter);
const channelId = useQueryParam("channel", "");

const filters = computed<ActivityFilters>(() => ({
  category: category.value,
  channelId: channelId.value,
}));
const feed = useActivityFeed(appId, filters);

const ordered = computed(() => orderChannels(channels.value).map((row) => row.channel));
const filtered = computed(() => category.value !== "all" || Boolean(channelId.value));
const filterLabel = computed(
  () => EVENT_FILTERS.find((option) => option.value === category.value)?.label.toLowerCase() ?? "",
);
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Activity"
      description="What every device reported, newest first: checks, downloads, deliveries, failures. Live while this page is open."
    >
      <template #badges>
        <Spinner
          v-if="feed.isFetching.value && !feed.isPending.value"
          class="text-muted-foreground size-3.5"
          aria-label="Refreshing"
        />
      </template>
    </PageHeader>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <EventFilterChips v-model="category" />
      <label class="flex items-center gap-2 text-sm">
        <span class="text-muted-foreground text-xs">Channel</span>
        <NativeSelect v-model="channelId" class="h-8 min-w-44 text-xs">
          <NativeSelectOption value="">All channels</NativeSelectOption>
          <NativeSelectOption v-for="channel in ordered" :key="channel.id" :value="channel.id">{{
            channel.name
          }}</NativeSelectOption>
        </NativeSelect>
      </label>
    </div>

    <ErrorNotice v-if="feed.error.value" :error="feed.error.value" :retry="feed.refetch" />
    <div v-else-if="feed.isPending.value" class="space-y-3" aria-busy="true">
      <Skeleton v-for="index in 8" :key="index" class="h-10 w-full" />
    </div>
    <EmptyState
      v-else-if="feed.events.value.length === 0 && !filtered"
      :icon="Activity"
      title="No device has reported anything yet"
      description="Events appear once an app using @capuchoo/updater checks this server for updates."
    />
    <p
      v-else-if="feed.events.value.length === 0"
      class="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm"
    >
      No {{ category === "all" ? "" : `${filterLabel} ` }}event{{
        channelId ? " on this channel" : ""
      }}
      in the kept history.
    </p>
    <section v-else class="bg-card rounded-lg border p-4">
      <EventTimeline
        :events="feed.events.value"
        :has-more="feed.hasMore.value"
        :loading-older="feed.loadingOlder.value"
        :older-error="feed.olderError.value"
        :collapse-checks="category !== 'check'"
        @load-older="feed.loadOlder"
        @retry-older="feed.retryOlder"
      >
        <template #subject="{ event }">
          <ActivityDeviceLink :device="event.device" />
        </template>
      </EventTimeline>
    </section>
  </PageContainer>
</template>
