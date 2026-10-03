<script setup lang="ts">
import { useStorage } from "@vueuse/core";
import type { TimelineTrack } from "../../lib/timeline";
import type { TrackMark } from "../../lib/track-marks";
import PlaybackControls from "./PlaybackControls.vue";
import PlaybackOptions from "./PlaybackOptions.vue";
import ScrubberTimeline from "./ScrubberTimeline.vue";

const props = defineProps<{
  playing: boolean;
  time: number;
  duration: number;
  speed: number;
  skipInactive: boolean;
  live: boolean;
  following: boolean;
  issueCount: number;
  issueIndex: number;
  tracks: readonly TimelineTrack[];
  marks: readonly TrackMark[];
  loaded: number;
}>();
const emit = defineEmits<{
  toggle: [];
  seek: [ms: number];
  speed: [value: number];
  skipInactive: [value: boolean];
  follow: [];
  issue: [direction: 1 | -1];
}>();

const lanes = useStorage("capuchoo.recording.lanes", true);
</script>

<template>
  <div
    class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 md:gap-y-0 [grid-template-areas:'track_track'_'left_right'] md:grid-cols-[auto_minmax(0,1fr)_auto] md:[grid-template-areas:'left_track_right'_'labels_track_.']"
  >
    <PlaybackControls
      class="[grid-area:left]"
      :playing="props.playing"
      :time="props.time"
      :duration="props.duration"
      :live="props.live"
      :following="props.following"
      @toggle="emit('toggle')"
      @seek="emit('seek', $event)"
      @follow="emit('follow')"
    />

    <ScrubberTimeline
      class="self-start [grid-area:track]"
      :tracks="props.tracks"
      :marks="props.marks"
      :duration="props.duration"
      :time="props.time"
      :loaded="props.loaded"
      :lanes="lanes"
      @seek="emit('seek', $event)"
    />

    <ul
      v-if="lanes"
      class="hidden flex-col gap-1 self-start pb-1 [grid-area:labels] md:flex"
      aria-hidden="true"
    >
      <li
        v-for="track in props.tracks"
        :key="track.key"
        class="text-muted-foreground h-2.5 text-right text-[10px] leading-[10px]"
      >
        {{ track.label }}
      </li>
    </ul>

    <PlaybackOptions
      v-model:lanes="lanes"
      class="justify-self-end [grid-area:right]"
      :speed="props.speed"
      :skip-inactive="props.skipInactive"
      :issue-count="props.issueCount"
      :issue-index="props.issueIndex"
      @speed="emit('speed', $event)"
      @skip-inactive="emit('skipInactive', $event)"
      @issue="emit('issue', $event)"
    />
  </div>
</template>
