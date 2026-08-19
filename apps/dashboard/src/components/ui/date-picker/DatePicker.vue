<script setup lang="ts">
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: Date | string
  class?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: Date | string): void
}>()

const modelValue = useVModel(props, 'modelValue', emit, { passive: true })

// Convert date to string for input
const dateString = computed({
  get: () => {
    if (!modelValue.value) return ''
    if (modelValue.value instanceof Date) {
      return modelValue.value.toISOString().split('T')[0]
    }
    return modelValue.value
  },
  set: (value: string) => {
    modelValue.value = value ? new Date(value) : undefined
  }
})
</script>

<template>
  <input
    v-model="dateString"
    type="date"
    :class="
      cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  >
</template>