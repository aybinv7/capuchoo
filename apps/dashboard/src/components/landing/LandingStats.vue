<script setup lang="ts">
import { ref, watch } from 'vue'
import { useTransition, TransitionPresets, useIntersectionObserver } from '@vueuse/core'

const statsRef = ref(null)
const isVisible = ref(false)

const { stop } = useIntersectionObserver(
  statsRef,
  (isIntersecting) => {
    if (isIntersecting) {
      isVisible.value = true
      stop()
    }
  },
  { threshold: 0.5 }, // Trigger when 50% visible
)

const stats = [
  { label: 'Active Devices', value: 15000, suffix: '+', duration: 1500 },
  { label: 'Updates Served', value: 2500, suffix: '+', duration: 2000 },
  { label: 'Uptime', value: 99.99, suffix: '%', decimals: 2, duration: 2500 },
  { label: 'Data Saved', value: 450, suffix: 'TB', duration: 3000 },
]

// Create reactive counters for each stat
const counters = stats.map((stat) => {
  const source = ref(0)
  const output = useTransition(source, {
    duration: stat.duration,
    transition: TransitionPresets.easeOutExpo,
  })

  // Watch visibility to trigger animation
  watch(isVisible, (visible) => {
    if (visible) {
      source.value = stat.value
    }
  })

  return output
})

// Format helper
const formatNumber = (num: number, decimals = 0) => {
  if (decimals > 0) return num.toFixed(decimals)

  // Custom large number formatting if needed, but for ticking simple locale string is good
  // However, useTransition updates rapidly, so we might want to avoid locale conversion every frame
  // Simple integer round is better for counting
  return Math.round(num).toLocaleString('en-US')
}
</script>

<template>
  <section ref="statsRef" class="py-24 border-y border-stone-800 bg-stone-950 relative z-10">
    <div class="max-w-7xl mx-auto px-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
        <div v-for="(stat, index) in stats" :key="stat.label" class="space-y-2">
          <div class="text-4xl md:text-5xl font-bold text-white tabular-nums tracking-tight">
            <span>{{ formatNumber(counters?.[index]?.value ?? 0, stat.decimals) }}</span>
            <span class="text-primary">{{ stat.suffix }}</span>
          </div>
          <div
            class="text-sm md:text-base font-semibold text-muted-foreground uppercase tracking-wider"
          >
            {{ stat.label }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
