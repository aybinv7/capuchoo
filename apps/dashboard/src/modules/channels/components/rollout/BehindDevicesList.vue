<script setup lang="ts">
import { ArrowRight, CircleCheck } from "@lucide/vue";
import { RouterLink } from "vue-router";
import AttributeChips from "@/shared/devices/components/AttributeChips.vue";
import { deviceTitle } from "@/shared/devices/lib/device-title";
import PlatformIcon from "@/shared/components/PlatformIcon.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { formatCount } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import { BUILTIN_VERSION } from "../../lib/version-mix";
import type { BehindDevice } from "../../types/channel-insights.types";

const props = defineProps<{
  devices: readonly BehindDevice[];
  /** Every device not on the current version, of which `devices` is the head. */
  behind: number;
  /** Every device resolved to the channel. */
  total: number;
  version: string;
  channelId: string;
}>();

const versionLabel = (version: string | null) =>
  version === BUILTIN_VERSION ? "built-in" : (version ?? "unknown");
</script>

<template>
  <div class="flex min-w-0 flex-col">
    <header class="flex items-center justify-between gap-2 pb-2">
      <span class="text-muted-foreground text-[11px] font-medium tracking-wide uppercase"
        >Behind</span
      >
      <span
        v-if="props.behind > 0"
        class="bg-warning-soft text-warning rounded-full px-1.5 font-mono text-[11px] tabular"
        >{{ formatCount(props.behind, true) }}</span
      >
    </header>
    <div
      v-if="props.behind === 0 && props.total > 0"
      class="bg-success-soft/50 text-success flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm"
      role="status"
    >
      <CircleCheck class="size-6" />
      <span
        >Every device is on <span class="font-mono font-medium">{{ props.version }}</span></span
      >
    </div>
    <p
      v-else-if="props.total === 0"
      class="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center text-xs text-pretty"
    >
      No device resolves to this channel yet.
    </p>
    <template v-else>
      <ul class="-mx-2 divide-y">
        <li v-for="device in props.devices" :key="device.id">
          <RouterLink
            :to="{ name: RouteName.device, params: { deviceId: device.id } }"
            class="hover:bg-accent/60 focus-visible:ring-ring/50 flex min-w-0 items-center gap-2.5 rounded-md px-2 py-2 outline-none focus-visible:ring-3"
          >
            <span
              class="bg-surface text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md border"
            >
              <PlatformIcon :platform="device.platform" class="size-4" />
            </span>
            <span class="min-w-0 flex-1 space-y-0.5">
              <span class="block truncate text-sm">{{ deviceTitle(device) }}</span>
              <AttributeChips v-if="device.attributes" :attributes="device.attributes" />
            </span>
            <span class="flex shrink-0 flex-col items-end gap-0.5">
              <span class="flex items-center gap-1 font-mono text-[11px]">
                <span class="text-warning">{{ versionLabel(device.version_name) }}</span>
                <ArrowRight class="text-muted-foreground size-3" />
                <span>{{ props.version }}</span>
              </span>
              <span class="text-muted-foreground text-[11px]">
                <RelativeTime v-if="device.last_seen_at" :value="device.last_seen_at" />
                <template v-else>never seen</template>
              </span>
            </span>
          </RouterLink>
        </li>
      </ul>
      <p
        v-if="props.devices.length === 0"
        class="text-muted-foreground py-4 text-center text-xs text-pretty"
      >
        None of them has been seen recently enough to list.
      </p>
      <RouterLink
        :to="{ name: RouteName.devices, query: { channel: props.channelId } }"
        class="text-primary mt-2 inline-flex items-center gap-1 self-start text-xs underline-offset-4 hover:underline"
      >
        View all {{ formatCount(props.behind, true) }} behind
        <ArrowRight class="size-3" />
      </RouterLink>
    </template>
  </div>
</template>
