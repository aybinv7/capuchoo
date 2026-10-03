<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  FastForward,
  Keyboard,
  Pause,
  Play,
  Radio,
  RotateCcw,
  RotateCw,
} from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  issueCount: number;
  /** 1-based position of the last issue at or before the playhead; 0 before the first. */
  issueIndex: number;
}>();
const emit = defineEmits<{
  toggle: [];
  seek: [ms: number];
  speed: [value: number];
  skipInactive: [value: boolean];
  follow: [];
  issue: [direction: 1 | -1];
}>();

const SPEEDS = [0.5, 1, 2, 4, 8];
const SHORTCUTS: Array<[string[], string]> = [
  [["Space"], "Play or pause"],
  [["←", "→"], "Back or forward 5 s (with Shift, 30 s)"],
  [["N", "P"], "Next or previous issue"],
  [["S"], "Hide or show the inspector"],
  [["D"], "Open the data tables"],
  [["B"], "Bring the inspector back"],
  [["F"], "Follow a live session"],
];
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
    <div class="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="icon-sm"
            class="size-8 rounded-full"
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

    <div
      v-if="props.issueCount > 0"
      class="border-destructive/30 bg-danger-soft/50 flex items-center rounded-full border"
    >
      <Button
        variant="ghost"
        size="icon-xs"
        class="rounded-full"
        aria-label="Previous issue"
        @click="emit('issue', -1)"
      >
        <ChevronLeft />
      </Button>
      <span class="text-destructive tabular px-1 text-[11px] font-medium">
        Issue {{ props.issueIndex }}/{{ props.issueCount }}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        class="rounded-full"
        aria-label="Next issue"
        @click="emit('issue', 1)"
      >
        <ChevronRight />
      </Button>
    </div>

    <div class="ml-auto flex flex-wrap items-center gap-2">
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
        <SelectTrigger
          size="sm"
          class="h-7 w-[4.5rem] font-mono text-xs"
          aria-label="Playback speed"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="speed in SPEEDS" :key="speed" :value="String(speed)">
            {{ speed }}×
          </SelectItem>
        </SelectContent>
      </Select>
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts">
            <Keyboard />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="w-72">
          <dl class="space-y-2 text-xs">
            <div v-for="[keys, label] in SHORTCUTS" :key="label" class="flex items-center gap-3">
              <dt class="flex w-20 shrink-0 gap-1">
                <Kbd v-for="key in keys" :key="key">{{ key }}</Kbd>
              </dt>
              <dd class="text-muted-foreground">{{ label }}</dd>
            </div>
          </dl>
        </PopoverContent>
      </Popover>
    </div>
  </div>
</template>
