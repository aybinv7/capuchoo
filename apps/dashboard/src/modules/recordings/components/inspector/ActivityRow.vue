<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { ActivityItem } from "../../lib/activity";
import { TONE_SOFT, TONE_TEXT } from "@/shared/lib/tone-styles";
import { LANE_ICONS } from "./rows";

const props = defineProps<{ item: ActivityItem }>();
</script>

<template>
  <span
    :class="
      cn(
        'flex size-5 shrink-0 items-center justify-center rounded',
        TONE_SOFT[props.item.tone],
        TONE_TEXT[props.item.tone],
      )
    "
  >
    <component :is="LANE_ICONS[props.item.lane]" class="size-3" aria-hidden="true" />
  </span>
  <span class="min-w-0 flex-1 truncate" :title="props.item.title">{{ props.item.title }}</span>
  <span
    v-if="props.item.detail"
    class="text-muted-foreground max-w-[40%] shrink-0 truncate text-[11px]"
    :title="props.item.detail"
    >{{ props.item.detail }}</span
  >
</template>
