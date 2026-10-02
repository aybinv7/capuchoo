<script setup lang="ts">
import { History, PackageOpen, Rocket } from "@lucide/vue";
import { computed, onScopeDispose } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import GateButton from "@/shared/components/GateButton.vue";
import { useNow } from "@/shared/composables/useNow";
import type { Gate } from "@/shared/lib/gate";
import { dayKey, parseDayKey } from "@/shared/period/lib/local-day";
import { useChannelRollout } from "../../composables/useChannelRollout";
import { fillCurve } from "../../lib/rollout-curve";
import { versionMix } from "../../lib/version-mix";
import AdoptionCurve from "./AdoptionCurve.vue";
import AdoptionSummary from "./AdoptionSummary.vue";
import BehindDevicesList from "./BehindDevicesList.vue";
import VersionMixBar from "./VersionMixBar.vue";

const props = defineProps<{ appId: string; channelId: string; deliverGate: Gate }>();
const emit = defineEmits<{ deliver: [] }>();

const query = useChannelRollout(
  () => props.appId,
  () => props.channelId,
);
const clock = useNow();
onScopeDispose(clock.release);

const rollout = computed(() => query.data.value ?? null);
const current = computed(() => rollout.value?.current ?? null);
const today = computed(() => dayKey(new Date(clock.now.value)));
const segments = computed(() =>
  rollout.value ? versionMix(rollout.value.mix, current.value?.version ?? null) : [],
);
const curve = computed(() => {
  const value = rollout.value;
  if (!value?.current) return [];
  return fillCurve(value.curve, value.current.delivered_at, parseDayKey(today.value) ?? new Date());
});
const behind = computed(() =>
  rollout.value ? Math.max(0, rollout.value.devices - rollout.value.on_current) : 0,
);
</script>

<template>
  <section class="bg-card min-w-0 rounded-lg border" aria-labelledby="channel-rollout-heading">
    <header class="flex flex-wrap items-center gap-2 px-4 pt-3">
      <h2 id="channel-rollout-heading" class="flex items-center gap-2 text-sm font-medium">
        Rollout
        <span v-if="current" class="text-muted-foreground font-mono font-normal">{{
          current.version
        }}</span>
      </h2>
      <span
        v-if="current?.rollback"
        class="border-warning/30 bg-warning-soft text-warning inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
      >
        <History class="size-3" />
        rolled back from
        <span class="font-mono">{{ current.from_version ?? "a newer version" }}</span>
      </span>
      <Spinner
        v-if="query.isFetching.value && !query.isPending.value"
        class="text-muted-foreground size-3"
        aria-label="Refreshing rollout"
      />
    </header>

    <div v-if="query.error.value && !rollout" class="p-4">
      <ErrorNotice :error="query.error.value" :retry="query.refetch" />
    </div>

    <div
      v-else-if="!rollout"
      class="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
      aria-busy="true"
    >
      <div class="space-y-5">
        <div class="flex items-center gap-5">
          <Skeleton class="size-24 rounded-full" />
          <div class="space-y-2">
            <Skeleton class="h-9 w-32" />
            <Skeleton class="h-4 w-48" />
          </div>
        </div>
        <Skeleton class="h-3 w-full rounded-full" />
        <Skeleton class="h-32 w-full" />
      </div>
      <div class="space-y-2">
        <Skeleton v-for="index in 4" :key="index" class="h-11 w-full" />
      </div>
    </div>

    <div v-else-if="!current" class="space-y-5 p-4">
      <div
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center"
      >
        <PackageOpen class="text-muted-foreground size-8" />
        <div class="space-y-1">
          <p class="text-sm font-medium">No OTA bundle is live here</p>
          <p class="text-muted-foreground max-w-md text-xs text-pretty">
            <template v-if="rollout.devices > 0"
              >{{ rollout.devices }}
              {{ rollout.devices === 1 ? "device runs" : "devices run" }} what their native build
              shipped with. Deliver a bundle to start a rollout.</template
            >
            <template v-else
              >No device resolves to this channel yet. Deliver a bundle, and the rollout shows here
              as devices check in.</template
            >
          </p>
        </div>
        <GateButton size="sm" :gate="props.deliverGate" @click="emit('deliver')">
          <Rocket />
          Deliver
        </GateButton>
      </div>
      <VersionMixBar v-if="segments.length" :segments="segments" :channel-id="props.channelId" />
    </div>

    <div v-else class="grid gap-x-8 gap-y-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div class="min-w-0 space-y-6">
        <AdoptionSummary
          :on-current="rollout.on_current"
          :devices="rollout.devices"
          :version="current.version"
        />
        <VersionMixBar v-if="segments.length" :segments="segments" :channel-id="props.channelId" />
        <AdoptionCurve :points="curve" :current="current" :devices="rollout.devices" />
      </div>
      <BehindDevicesList
        class="lg:border-l lg:pl-6"
        :devices="rollout.behind"
        :behind="behind"
        :total="rollout.devices"
        :version="current.version"
        :channel-id="props.channelId"
      />
    </div>

    <div v-if="query.error.value && rollout" class="px-4 pb-4">
      <ErrorNotice :error="query.error.value" :retry="query.refetch" />
    </div>
  </section>
</template>
