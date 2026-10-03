<script setup lang="ts">
import { PanelRightClose, PanelRightOpen } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

/** Whether the inspector sits beside the screen. */
const open = defineModel<boolean>({ required: true });
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        :variant="open ? 'ghost' : 'outline'"
        size="sm"
        :class="cn(open ? 'size-8 px-0' : 'bg-background/80 backdrop-blur', props.class)"
        :aria-pressed="open"
        :aria-label="open ? 'Hide the inspector' : 'Show the inspector'"
        @click="open = !open"
      >
        <PanelRightClose v-if="open" />
        <template v-else>
          <PanelRightOpen />
          Inspector
        </template>
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{ open ? "Hide" : "Show" }} the inspector <Kbd>S</Kbd></TooltipContent>
  </Tooltip>
</template>
