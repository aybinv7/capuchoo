<script setup lang="ts">
import type { RadioGroupItemProps, RadioGroupItemEmits } from 'reka-ui'
import { RadioGroupIndicator, RadioGroupItem, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<RadioGroupItemProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<RadioGroupItemEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <RadioGroupItem
    v-bind="forwarded"
    :class="
      cn(
        'aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  >
    <RadioGroupIndicator class="flex items-center justify-center text-current">
      <div class="h-2.5 w-2.5 rounded-full bg-current" />
    </RadioGroupIndicator>
  </RadioGroupItem>
</template>
