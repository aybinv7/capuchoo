<script setup lang="ts" generic="E extends DeviceEvent">
import { ChevronsDown } from "@lucide/vue";
import { computed, onScopeDispose } from "vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useNow } from "@/shared/composables/useNow";
import { dayKeyFormatter, dayLabel, groupTimeline } from "../lib/timeline";
import type { DeviceEvent } from "../types/devices.types";
import CheckRunRow from "./CheckRunRow.vue";
import EventRow from "./EventRow.vue";

const DAY_MS = 86_400_000;
const dayOf = dayKeyFormatter();

const props = withDefaults(
  defineProps<{
    events: readonly E[];
    hasMore: boolean;
    loadingOlder: boolean;
    olderError?: unknown;
    collapseChecks?: boolean;
  }>(),
  { collapseChecks: true },
);
const emit = defineEmits<{ loadOlder: []; retryOlder: [] }>();
defineSlots<{ subject?: (scope: { event: E }) => unknown }>();

const clock = useNow();
onScopeDispose(clock.release);

const days = computed(() => groupTimeline(props.events, dayOf, props.collapseChecks));
const today = computed(() => dayOf(new Date(clock.now.value).toISOString()));
const yesterday = computed(() => dayOf(new Date(clock.now.value - DAY_MS).toISOString()));
</script>

<template>
  <div class="space-y-5">
    <section
      v-for="day in days"
      :key="day.day"
      class="[contain-intrinsic-size:auto_480px] [content-visibility:auto]"
    >
      <h3
        class="text-muted-foreground mb-1 flex items-center gap-2 text-[11px] font-medium tracking-wide uppercase"
      >
        {{ dayLabel(day.day, today, yesterday) }}
        <span class="bg-border h-px flex-1" aria-hidden="true" />
      </h3>
      <ol class="relative">
        <span class="bg-border absolute top-3 bottom-3 left-3 w-px" aria-hidden="true" />
        <li v-for="item in day.items" :key="item.key" class="relative">
          <CheckRunRow
            v-if="item.type === 'checks'"
            :events="item.events"
            :from="item.from"
            :to="item.to"
          >
            <template #subject="{ event }">
              <slot name="subject" :event="event" />
            </template>
          </CheckRunRow>
          <EventRow v-else :event="item.event">
            <template #subject>
              <slot name="subject" :event="item.event" />
            </template>
          </EventRow>
        </li>
      </ol>
    </section>

    <ErrorNotice
      v-if="props.olderError"
      :error="props.olderError"
      :retry="() => emit('retryOlder')"
    />
    <div v-else-if="props.hasMore" class="flex justify-center">
      <Button
        variant="outline"
        size="sm"
        :disabled="props.loadingOlder"
        :aria-busy="props.loadingOlder"
        @click="emit('loadOlder')"
      >
        <Spinner v-if="props.loadingOlder" />
        <ChevronsDown v-else />
        Load older
      </Button>
    </div>
    <p v-else-if="props.events.length" class="text-muted-foreground text-center text-xs">
      Start of the kept history.
    </p>
  </div>
</template>
