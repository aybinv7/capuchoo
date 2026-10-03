<script setup lang="ts">
import type { TimelineTrack } from "../../lib/timeline";
import { TONE_COLOR } from "../../lib/tones";

const props = defineProps<{ tracks: readonly TimelineTrack[] }>();
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <div v-for="track in props.tracks" :key="track.key" class="flex h-2 items-center gap-2">
      <span
        class="text-muted-foreground hidden w-16 shrink-0 text-right text-[10px] leading-none md:block"
        >{{ track.label }}</span
      >
      <svg
        class="h-full min-w-0 flex-1 overflow-visible"
        :viewBox="`0 0 ${track.density.length} 1`"
        preserveAspectRatio="none"
        role="img"
        :aria-label="`${track.label} activity`"
      >
        <rect x="0" y="0" :width="track.density.length" height="1" fill="var(--muted)" />
        <template v-for="(value, index) in track.density" :key="index">
          <rect
            v-if="value > 0"
            :x="index"
            :y="1 - Math.max(0.25, value)"
            width="1"
            :height="Math.max(0.25, value)"
            :fill="TONE_COLOR[track.tone]"
            :opacity="track.tone === 'muted' ? 0.45 : 0.55"
          />
        </template>
        <rect
          v-for="(mark, index) in track.marks"
          :key="`m${index}`"
          :x="mark.at * track.density.length - 0.4"
          y="0"
          width="0.8"
          height="1"
          :fill="TONE_COLOR[mark.tone]"
        >
          <title>{{ mark.label }}</title>
        </rect>
      </svg>
    </div>
  </div>
</template>
