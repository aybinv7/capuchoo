<script setup lang="ts">
import { ChartNoAxesGantt, ChevronLeft, ChevronRight, FastForward } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ShortcutsPopover from "./ShortcutsPopover.vue";

const props = defineProps<{
  speed: number;
  skipInactive: boolean;
  issueCount: number;
  /** 1-based position of the last issue at or before the playhead; 0 before the first. */
  issueIndex: number;
}>();
const emit = defineEmits<{
  speed: [value: number];
  skipInactive: [value: boolean];
  issue: [direction: 1 | -1];
}>();
/** Whether the activity lanes show under the scrubber. */
const lanes = defineModel<boolean>("lanes", { required: true });

const SPEEDS = [0.5, 1, 2, 4, 8];
</script>

<template>
  <div class="flex items-center gap-1">
    <ButtonGroup v-if="props.issueCount > 0" class="mr-1" aria-label="Issues">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous issue"
            @click="emit('issue', -1)"
          >
            <ChevronLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous issue <Kbd>P</Kbd></TooltipContent>
      </Tooltip>
      <Button
        variant="outline"
        size="sm"
        class="text-destructive tabular pointer-events-none px-2 text-xs"
        tabindex="-1"
      >
        <span class="bg-destructive size-1.5 rounded-full" aria-hidden="true" />
        {{ props.issueIndex }}/{{ props.issueCount }}
        <span class="hidden xl:inline">{{ props.issueCount === 1 ? "issue" : "issues" }}</span>
      </Button>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next issue"
            @click="emit('issue', 1)"
          >
            <ChevronRight />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next issue <Kbd>N</Kbd></TooltipContent>
      </Tooltip>
    </ButtonGroup>

    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="tabular w-12 px-0 font-mono text-xs"
              aria-label="Playback speed"
            >
              {{ props.speed }}×
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Playback speed</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" class="w-32">
        <DropdownMenuLabel class="text-muted-foreground text-xs font-normal"
          >Speed</DropdownMenuLabel
        >
        <DropdownMenuRadioGroup
          :model-value="String(props.speed)"
          @update:model-value="emit('speed', Number($event))"
        >
          <DropdownMenuRadioItem
            v-for="speed in SPEEDS"
            :key="speed"
            :value="String(speed)"
            class="font-mono text-xs"
          >
            {{ speed }}×
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <Tooltip>
      <TooltipTrigger as-child>
        <Toggle
          size="sm"
          :model-value="props.skipInactive"
          aria-label="Skip idle moments"
          @update:model-value="emit('skipInactive', $event)"
        >
          <FastForward />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{{
        props.skipInactive ? "Skipping idle moments" : "Skip idle moments"
      }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <Toggle
          v-model="lanes"
          size="sm"
          class="hidden md:inline-flex"
          aria-label="Show activity lanes"
        >
          <ChartNoAxesGantt />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{{ lanes ? "Hide" : "Show" }} the activity lanes</TooltipContent>
    </Tooltip>

    <ShortcutsPopover />
  </div>
</template>
