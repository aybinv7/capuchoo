<script setup lang="ts">
import { ArrowUp } from "@lucide/vue";
import { useWindowScroll } from "@vueuse/core";
import { computed } from "vue";

const { y } = useWindowScroll({ throttle: 100 });
const visible = computed(() => y.value > 900);

function toTop() {
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200"
    enter-from-class="translate-y-2 opacity-0"
    leave-active-class="transition duration-150"
    leave-to-class="translate-y-2 opacity-0"
  >
    <button
      v-if="visible"
      type="button"
      class="bg-primary text-primary-foreground shadow-primary/30 focus-visible:ring-ring/60 fixed right-5 bottom-5 z-40 grid size-11 place-items-center rounded-full shadow-lg transition hover:brightness-110 focus-visible:ring-4 focus-visible:outline-none"
      aria-label="Back to top"
      @click="toTop"
    >
      <ArrowUp class="size-5" />
    </button>
  </Transition>
</template>
