<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCount, formatPercent } from "@/shared/lib/format";
import { segmentFill, type MixSegment } from "../../lib/version-mix";

const props = defineProps<{ segments: readonly MixSegment[] }>();

const describe = (segment: MixSegment) =>
  `${segment.label} · ${formatCount(segment.devices, true)} ${segment.devices === 1 ? "device" : "devices"} (${formatPercent(segment.share)})`;
</script>

<template>
  <figure class="space-y-2.5">
    <figcaption class="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
      Version mix
    </figcaption>
    <div
      class="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
      role="img"
      :aria-label="props.segments.map(describe).join(', ')"
    >
      <Tooltip v-for="segment in props.segments" :key="segment.version">
        <TooltipTrigger as-child>
          <span
            class="h-full min-w-1 first:rounded-l-full last:rounded-r-full"
            :style="{ flex: `${segment.devices} 1 0%`, background: segmentFill(segment) }"
          />
        </TooltipTrigger>
        <TooltipContent>{{ describe(segment) }}</TooltipContent>
      </Tooltip>
    </div>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <li
        v-for="segment in props.segments"
        :key="segment.version"
        class="flex items-center gap-1.5"
      >
        <span
          class="size-2.5 shrink-0 rounded-sm"
          :class="segment.hatched && 'ring-border ring-1 ring-inset'"
          :style="{ background: segmentFill(segment) }"
          aria-hidden="true"
        />
        <span
          :class="[
            segment.tone === 'current' ? 'text-foreground font-medium' : 'text-muted-foreground',
            segment.tone === 'builtin' || segment.tone === 'other' ? '' : 'font-mono',
          ]"
          >{{ segment.label }}</span
        >
        <span class="text-muted-foreground font-mono tabular">{{
          formatCount(segment.devices)
        }}</span>
      </li>
    </ul>
  </figure>
</template>
