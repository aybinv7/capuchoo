<script setup lang="ts">
import { Undo2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const props = defineProps<{
  label: string;
  description?: string;
  /** Set on this scope rather than inherited. */
  overridden: boolean;
  /** Where the value comes from when it is not overridden. */
  inheritedFrom: string;
  for?: string;
}>();
const emit = defineEmits<{ reset: [] }>();
</script>

<template>
  <div
    class="grid gap-x-6 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center"
  >
    <div class="min-w-0 space-y-0.5">
      <div class="flex items-center gap-2">
        <label :for="props.for" class="text-sm font-medium">{{ props.label }}</label>
        <span
          v-if="props.overridden"
          class="bg-primary size-1.5 rounded-full"
          aria-label="Set on this scope"
        />
        <span v-else class="text-muted-foreground text-[11px]">from {{ props.inheritedFrom }}</span>
      </div>
      <p v-if="props.description" class="text-muted-foreground text-xs text-pretty">
        {{ props.description }}
      </p>
    </div>
    <div class="flex items-center justify-end gap-1">
      <slot />
      <Tooltip v-if="props.overridden">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="`Inherit ${props.label} from ${props.inheritedFrom}`"
            @click="emit('reset')"
          >
            <Undo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Inherit from {{ props.inheritedFrom }}</TooltipContent>
      </Tooltip>
      <span v-else class="size-8 shrink-0" aria-hidden="true" />
    </div>
  </div>
</template>
