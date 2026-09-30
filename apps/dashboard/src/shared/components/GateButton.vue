<script setup lang="ts">
import { Button, type ButtonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Gate } from "../lib/gate";

const props = withDefaults(
  defineProps<{
    gate: Gate;
    variant?: ButtonVariants["variant"];
    size?: ButtonVariants["size"];
    loading?: boolean;
    disabled?: boolean;
    type?: "button" | "submit";
  }>(),
  { variant: "default", size: "default", loading: false, disabled: false, type: "button" },
);

const emit = defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <Button
    v-if="props.gate.ok"
    :variant="props.variant"
    :size="props.size"
    :type="props.type"
    :disabled="props.disabled || props.loading"
    :aria-busy="props.loading"
    @click="emit('click', $event)"
  >
    <slot />
  </Button>
  <Tooltip v-else>
    <TooltipTrigger as-child>
      <span tabindex="0" class="inline-flex cursor-not-allowed">
        <Button
          :variant="props.variant"
          :size="props.size"
          disabled
          class="pointer-events-none"
          :aria-description="props.gate.reason"
        >
          <slot />
        </Button>
      </span>
    </TooltipTrigger>
    <TooltipContent class="max-w-72 text-pretty">
      {{ props.gate.reason }}
    </TooltipContent>
  </Tooltip>
</template>
