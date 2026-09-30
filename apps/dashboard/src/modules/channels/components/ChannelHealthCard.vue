<script setup lang="ts">
import { computed } from "vue";
import AdoptionMeter from "@/shared/components/AdoptionMeter.vue";
import { formatCount, formatPercent, ratio } from "@/shared/lib/format";
import type { ChannelHealth } from "@/shared/types/release";

const props = defineProps<{ health: ChannelHealth | null }>();

const successRate = computed(() => {
  const health = props.health;
  if (!health) return null;
  return ratio(health.installs_7d, health.installs_7d + health.failures_7d);
});
</script>

<template>
  <section class="bg-card rounded-lg border">
    <header class="text-muted-foreground border-b px-4 py-2.5 text-xs font-medium uppercase">
      Health
    </header>
    <div v-if="!props.health" class="text-muted-foreground px-4 py-6 text-sm">
      No telemetry yet.
    </div>
    <div v-else class="space-y-4 p-4">
      <div class="space-y-1.5">
        <div class="flex items-baseline justify-between text-xs">
          <span class="text-muted-foreground">On the current bundle</span>
          <span class="font-mono tabular"
            >{{ formatCount(props.health.on_current) }} /
            {{ formatCount(props.health.devices) }}</span
          >
        </div>
        <AdoptionMeter :on-current="props.health.on_current" :devices="props.health.devices" />
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div class="bg-surface rounded-md border px-3 py-2">
          <dt class="text-muted-foreground text-xs">Devices</dt>
          <dd class="font-mono text-lg font-semibold tabular">
            {{ formatCount(props.health.devices) }}
          </dd>
        </div>
        <div class="bg-surface rounded-md border px-3 py-2">
          <dt class="text-muted-foreground text-xs">Active 24h</dt>
          <dd class="font-mono text-lg font-semibold tabular">
            {{ formatCount(props.health.active_24h) }}
          </dd>
        </div>
        <div class="bg-surface rounded-md border px-3 py-2">
          <dt class="text-muted-foreground text-xs">Installs · fails 24h</dt>
          <dd class="font-mono text-lg font-semibold tabular">
            <span class="text-success">{{ formatCount(props.health.installs_24h) }}</span>
            <span class="text-muted-foreground text-sm"> · </span>
            <span
              :class="props.health.failures_24h ? 'text-destructive' : 'text-muted-foreground'"
              >{{ formatCount(props.health.failures_24h) }}</span
            >
          </dd>
        </div>
        <div class="bg-surface rounded-md border px-3 py-2">
          <dt class="text-muted-foreground text-xs">Success 7d</dt>
          <dd class="font-mono text-lg font-semibold tabular">{{ formatPercent(successRate) }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
