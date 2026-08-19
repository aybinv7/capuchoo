<script setup lang="ts">
import { ArrowUp } from 'lucide-vue-next'
import { useWindowScroll } from '@vueuse/core'

const { y } = useWindowScroll()

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-4"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-4"
  >
    <button
      v-if="y > 300"
      @click="scrollToTop"
      class="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[100] p-3 rounded-full bg-primary text-primary-foreground shadow-xl hover:bg-primary/90 hover:-translate-y-1 transition-all duration-300 group"
      aria-label="Scroll to top"
    >
      <ArrowUp class="w-6 h-6 group-hover:animate-bounce" />
    </button>
  </Transition>
</template>
