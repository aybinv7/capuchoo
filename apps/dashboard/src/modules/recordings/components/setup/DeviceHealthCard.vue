<script setup lang="ts">
import { ArrowUpRight } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import PlatformIcon from "@/shared/components/PlatformIcon.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import StatusDot from "@/shared/components/StatusDot.vue";
import { RouteName } from "@/shared/router/route-names";
import { healthChecks, overallTone } from "../../lib/health";
import type { RecorderCheckIn } from "../../types/recordings.types";

const props = defineProps<{ device: RecorderCheckIn }>();

const checks = computed(() => (props.device.health ? healthChecks(props.device.health) : []));
const tone = computed(() => (props.device.online ? overallTone(checks.value) : "muted"));
const label = computed(() => props.device.custom_id ?? `${props.device.device_id.slice(0, 8)}…`);
</script>

<template>
  <article class="bg-card space-y-3 rounded-lg border p-3">
    <header class="flex items-center gap-2">
      <StatusDot :tone="tone" :pulse="props.device.online" />
      <PlatformIcon :platform="props.device.platform" class="text-muted-foreground size-3.5" />
      <span
        class="min-w-0 flex-1 truncate font-mono text-xs font-medium"
        :title="props.device.device_id"
      >
        {{ label }}
      </span>
      <Badge v-if="props.device.health" variant="outline" class="font-mono text-[10px]">
        {{ props.device.health.mode }}
      </Badge>
    </header>
    <p class="text-muted-foreground flex flex-wrap gap-x-2 text-[11px]">
      <span class="font-mono">{{ props.device.version_name }}</span>
      <span v-if="props.device.channel">· {{ props.device.channel }}</span>
      <span v-if="props.device.health">· recorder {{ props.device.health.recorder }}</span>
      <span>· <RelativeTime :value="props.device.seen_at" /></span>
    </p>

    <ul v-if="checks.length" class="space-y-2">
      <li v-for="check in checks" :key="check.id" class="flex gap-2 text-xs">
        <StatusDot :tone="check.tone" class="mt-1" />
        <div class="min-w-0 flex-1">
          <p class="flex flex-wrap gap-x-2">
            <span class="text-muted-foreground">{{ check.label }}</span>
            <span class="font-medium break-words">{{ check.value }}</span>
          </p>
          <p v-if="check.fix" class="text-muted-foreground mt-0.5 text-[11px] text-pretty">
            {{ check.fix }}
          </p>
        </div>
      </li>
    </ul>
    <p v-else class="text-muted-foreground text-xs">
      This recorder predates health reports; update @capuchoo/recorder to see its checks.
    </p>

    <RouterLink
      v-if="props.device.device_uuid"
      :to="{ name: RouteName.recordings, query: { device: props.device.device_uuid } }"
      class="text-primary inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
    >
      Its recordings
      <ArrowUpRight class="size-3" aria-hidden="true" />
    </RouterLink>
  </article>
</template>
