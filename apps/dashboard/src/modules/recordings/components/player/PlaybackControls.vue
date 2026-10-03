<script setup lang="ts">
import { Pause, Play, RotateCcw, RotateCw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatOffset } from "../../lib/activity";

const props = defineProps<{
  playing: boolean;
  time: number;
  duration: number;
  live: boolean;
  following: boolean;
}>();
const emit = defineEmits<{ toggle: []; seek: [ms: number]; follow: [] }>();

const STEP_MS = 10_000;
</script>

<template>
  <div class="flex items-center gap-0.5">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          size="icon-sm"
          class="mr-1 rounded-full"
          :aria-label="props.playing ? 'Pause' : 'Play'"
          @click="emit('toggle')"
        >
          <Pause v-if="props.playing" class="fill-current" />
          <Play v-else class="translate-x-px fill-current" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ props.playing ? "Pause" : "Play" }} <Kbd>Space</Kbd></TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back 10 seconds"
          @click="emit('seek', props.time - STEP_MS)"
        >
          <RotateCcw />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Back 10 s</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Forward 10 seconds"
          @click="emit('seek', props.time + STEP_MS)"
        >
          <RotateCw />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Forward 10 s</TooltipContent>
    </Tooltip>

    <span class="tabular ml-1.5 font-mono text-xs whitespace-nowrap">
      <span class="text-foreground">{{ formatOffset(props.time) }}</span>
      <span class="text-muted-foreground"> / {{ formatOffset(props.duration) }}</span>
    </span>

    <button
      v-if="props.live"
      type="button"
      class="ml-2 inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold tracking-wide uppercase transition-colors"
      :class="
        props.following
          ? 'bg-destructive text-white'
          : 'bg-danger-soft text-destructive hover:bg-destructive hover:text-white'
      "
      :aria-pressed="props.following"
      :title="props.following ? 'Following the device live' : 'Jump to live · F'"
      @click="emit('follow')"
    >
      <span class="relative flex size-1.5">
        <span
          v-if="props.following"
          class="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75"
        />
        <span class="relative inline-flex size-1.5 rounded-full bg-current" />
      </span>
      Live
    </button>
  </div>
</template>
