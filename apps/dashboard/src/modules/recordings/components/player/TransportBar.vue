<script setup lang="ts">
import { FastForward, Pause, Play, Radio, RotateCcw, RotateCw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatOffset } from "../../lib/activity";

const props = defineProps<{
  playing: boolean;
  time: number;
  duration: number;
  speed: number;
  skipInactive: boolean;
  live: boolean;
  following: boolean;
}>();
const emit = defineEmits<{
  toggle: [];
  seek: [ms: number];
  speed: [value: number];
  skipInactive: [value: boolean];
  follow: [];
}>();

const SPEEDS = [0.5, 1, 2, 4, 8];
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
    <div class="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="icon"
            class="rounded-full"
            :aria-label="props.playing ? 'Pause' : 'Play'"
            @click="emit('toggle')"
          >
            <Pause v-if="props.playing" class="fill-current" />
            <Play v-else class="fill-current" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ props.playing ? "Pause" : "Play" }} <Kbd>Space</Kbd></TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Back 10 seconds"
        @click="emit('seek', props.time - 10_000)"
      >
        <RotateCcw />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Forward 10 seconds"
        @click="emit('seek', props.time + 10_000)"
      >
        <RotateCw />
      </Button>
    </div>

    <span class="tabular font-mono text-xs">
      <span class="text-foreground">{{ formatOffset(props.time) }}</span>
      <span class="text-muted-foreground"> / {{ formatOffset(props.duration) }}</span>
    </span>

    <div class="ml-auto flex flex-wrap items-center gap-3">
      <Button
        v-if="props.live"
        :variant="props.following ? 'default' : 'outline'"
        size="sm"
        :class="props.following ? 'bg-destructive hover:bg-destructive/90' : ''"
        @click="emit('follow')"
      >
        <Radio />
        {{ props.following ? "Following live" : "Jump to live" }}
      </Button>
      <div class="flex items-center gap-2">
        <Switch
          id="skip-inactive"
          :model-value="props.skipInactive"
          @update:model-value="emit('skipInactive', Boolean($event))"
        />
        <Label for="skip-inactive" class="text-muted-foreground text-xs font-normal">
          <FastForward class="size-3.5" aria-hidden="true" />
          Skip idle
        </Label>
      </div>
      <Select
        :model-value="String(props.speed)"
        @update:model-value="emit('speed', Number($event))"
      >
        <SelectTrigger size="sm" class="w-20 font-mono text-xs" aria-label="Playback speed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="speed in SPEEDS" :key="speed" :value="String(speed)">
            {{ speed }}×
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
