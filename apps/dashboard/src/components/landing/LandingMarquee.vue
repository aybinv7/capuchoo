<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  vertical?: boolean
  reverse?: boolean
  duration?: number
  gap?: string
}>()

const animationDuration = computed(() => `${props.duration || 40}s`)
</script>

<template>
  <div
    class="flex overflow-hidden select-none gap-4"
    :class="[vertical ? 'flex-col h-full' : 'flex-row w-full']"
    style="mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)"
  >
    <div
      v-for="i in 2"
      :key="i"
      class="flex shrink-0 gap-4"
      :class="[
        vertical ? 'flex-col animate-marquee-vertical' : 'flex-row animate-marquee',
        { 'direction-reverse': reverse },
      ]"
      :style="{ '--duration': animationDuration }"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.animate-marquee {
  animation: marquee var(--duration) linear infinite;
}

.animate-marquee-vertical {
  animation: marquee-vertical var(--duration) linear infinite;
}

.direction-reverse {
  animation-direction: reverse;
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(calc(-100% - 1rem)); /* 1rem is gap-4 */
  }
}

@keyframes marquee-vertical {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(calc(-100% - 1rem));
  }
}
</style>
