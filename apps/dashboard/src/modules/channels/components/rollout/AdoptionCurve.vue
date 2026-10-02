<script setup lang="ts">
import { Info } from "@lucide/vue";
import { computed } from "vue";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AreaChart from "@/shared/components/charts/AreaChart.vue";
import { placeMarkers } from "@/shared/components/charts/lib/markers";
import { formatCount } from "@/shared/lib/format";
import type { RolloutCurrent } from "../../types/channel-insights.types";
import type { CurveValue } from "../../lib/rollout-curve";

const props = defineProps<{
  points: readonly CurveValue[];
  current: RolloutCurrent;
  devices: number;
}>();

const markers = computed(() => {
  const at = props.current.delivered_at;
  if (!at) return [];
  const verb = props.current.rollback ? "Rolled back to" : "Delivered";
  const by = props.current.delivered_by ? ` by ${props.current.delivered_by}` : "";
  return placeMarkers(
    [
      {
        key: "delivery",
        at,
        color: props.current.rollback ? "var(--warning)" : "var(--primary)",
        label: `${verb} ${props.current.version}${by}`,
      },
    ],
    props.points.map((point) => point.key),
    "day",
  );
});
const taken = computed(() => props.points[props.points.length - 1]?.value ?? 0);
const describe = (value: number) =>
  `${formatCount(value, true)} ${value === 1 ? "device" : "devices"}`;
</script>

<template>
  <figure class="space-y-1">
    <figcaption class="flex items-center justify-between gap-2">
      <span
        class="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase"
      >
        Adoption since delivery
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              type="button"
              class="hover:text-foreground focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-3"
              aria-label="How adoption is counted"
            >
              <Info class="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent class="max-w-64 text-pretty normal-case">
            Devices that installed {{ props.current.version }} after it was delivered here. A device
            that already ran it counts as on the version, not in this curve.
          </TooltipContent>
        </Tooltip>
      </span>
      <span class="text-muted-foreground font-mono text-xs tabular"
        >{{ formatCount(taken, true) }} took it</span
      >
    </figcaption>
    <AreaChart
      v-if="props.points.length"
      :points="props.points"
      :ceiling="props.devices"
      :markers="markers"
      :describe="describe"
      :height="128"
      :label="`Devices on ${props.current.version} per day since its delivery`"
    />
    <p v-else class="text-muted-foreground py-6 text-center text-xs">
      No delivery time is known for this version, so there is no curve to draw.
    </p>
  </figure>
</template>
