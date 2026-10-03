<script setup lang="ts">
import type { AssistControl } from "@capuchoo/core";
import { ArrowLeft, Headset, PhoneOff } from "@lucide/vue";
import { useIntervalFn } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { RouteName } from "@/shared/router/route-names";
import { formatOffset } from "../../lib/activity";
import type { AssistPhase } from "../../types/assist.types";

const props = defineProps<{
  deviceId: string;
  deviceName: string;
  phase: AssistPhase;
  control: AssistControl;
}>();
const emit = defineEmits<{ end: [] }>();

const status = computed(() => {
  if (props.phase === "starting")
    return { label: "Asking", tone: "bg-muted text-muted-foreground" };
  if (props.phase === "waiting")
    return { label: "Waiting for the user", tone: "bg-warning-soft text-warning" };
  if (props.phase === "ended") return { label: "Ended", tone: "bg-muted text-muted-foreground" };
  if (props.control === "granted")
    return { label: "In control", tone: "bg-destructive text-white" };
  return { label: "Watching", tone: "bg-success-soft text-success" };
});

const since = ref<number | null>(null);
const now = ref(Date.now());
watch(
  () => props.phase,
  (phase) => {
    if (phase === "live" && since.value === null) since.value = Date.now();
  },
  { immediate: true },
);
const { pause } = useIntervalFn(() => (now.value = Date.now()), 1000);
watch(
  () => props.phase,
  (phase) => {
    if (phase === "ended") pause();
  },
);
</script>

<template>
  <header class="flex h-10 min-w-0 items-center gap-2">
    <Button variant="ghost" size="icon-sm" class="shrink-0" as-child>
      <RouterLink
        :to="{ name: RouteName.recordings, query: { device: props.deviceId } }"
        aria-label="Back to the device's recordings"
      >
        <ArrowLeft />
      </RouterLink>
    </Button>
    <Headset class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
    <h1 class="min-w-0 truncate text-sm font-semibold tracking-tight md:text-base">
      Assisting {{ props.deviceName }}
    </h1>
    <span
      class="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium"
      :class="status.tone"
      role="status"
    >
      <span
        v-if="props.phase === 'live'"
        class="size-1.5 animate-pulse rounded-full bg-current"
        aria-hidden="true"
      />
      {{ status.label }}
    </span>
    <span v-if="since !== null" class="text-muted-foreground tabular font-mono text-xs">
      {{ formatOffset(now - since) }}
    </span>

    <Button
      v-if="props.phase !== 'ended'"
      variant="outline"
      size="sm"
      class="text-destructive ml-auto shrink-0"
      @click="emit('end')"
    >
      <PhoneOff />
      End
    </Button>
  </header>
</template>
