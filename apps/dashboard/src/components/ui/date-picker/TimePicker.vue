<template>
  <select
    :value="modelValue"
    @change="handleChange"
    class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <option value="">{{ placeholder || 'Select time' }}</option>
    <option v-for="time in timeOptions" :key="time.value" :value="time.value">
      {{ time.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue?: string
  placeholder?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

withDefaults(defineProps<Props>(), {
  placeholder: 'Select time',
})
const emit = defineEmits<Emits>()

const timeOptions = computed(() => {
  const options = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      // Every 15 minutes
      const hourStr = hour.toString().padStart(2, '0')
      const minuteStr = minute.toString().padStart(2, '0')
      const value = `${hourStr}:${minuteStr}`

      // Format as 12-hour time for display
      const displayHour = hour % 12 || 12
      const ampm = hour < 12 ? 'AM' : 'PM'
      const label = `${displayHour}:${minuteStr} ${ampm}`

      options.push({ value, label })
    }
  }
  return options
})

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>
