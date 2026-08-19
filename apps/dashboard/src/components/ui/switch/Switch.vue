<script setup lang="ts">
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: boolean
  class?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const modelValue = useVModel(props, 'modelValue', emit, { passive: true })
</script>

<template>
  <button
    type="button"
    :class="
      cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        modelValue ? 'bg-primary' : 'bg-input',
        props.class,
      )
    "
    :aria-pressed="modelValue"
    role="switch"
    @click="modelValue = !modelValue"
  >
    <span
      :class="
        cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
          modelValue ? 'translate-x-5' : 'translate-x-0.5',
        )
      "
    />
  </button>
</template>
