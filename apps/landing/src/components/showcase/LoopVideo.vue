<script setup lang="ts">
import { Pause, Play } from "@lucide/vue";
import { useIntersectionObserver } from "@vueuse/core";
import { ref, useTemplateRef, watch } from "vue";
import { useReducedMotion } from "@/composables/useReducedMotion";

const props = defineProps<{ id: string; label: string }>();

const video = useTemplateRef<HTMLVideoElement>("video");
const reduced = useReducedMotion();
const inView = ref(false);
const paused = ref(true);
const userPaused = ref(false);

useIntersectionObserver(
  video,
  ([entry]) => {
    inView.value = Boolean(entry?.isIntersecting);
  },
  { threshold: 0.35 },
);

async function play() {
  try {
    await video.value?.play();
  } catch {
    paused.value = true;
  }
}

watch([inView, reduced, userPaused], ([visible, reduce, stopped]) => {
  if (!video.value) return;
  if (visible && !reduce && !stopped) void play();
  else video.value.pause();
});

function toggle() {
  if (!video.value) return;
  if (video.value.paused) {
    userPaused.value = false;
    void play();
  } else {
    userPaused.value = true;
    video.value.pause();
  }
}
</script>

<template>
  <div class="group relative">
    <video
      ref="video"
      muted
      loop
      playsinline
      preload="none"
      :poster="`/screens/${props.id}-poster.webp`"
      :aria-label="props.label"
      width="1280"
      height="800"
      class="block aspect-[16/10] h-auto w-full bg-black/5"
      @play="paused = false"
      @pause="paused = true"
    >
      <source :src="`/screens/${props.id}.webm`" type="video/webm" />
      <source :src="`/screens/${props.id}.mp4`" type="video/mp4" />
    </video>
    <button
      type="button"
      class="bg-ink/75 text-ink-foreground focus-visible:ring-ring/60 absolute right-3 bottom-3 grid size-9 place-items-center rounded-full opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
      :class="paused && 'opacity-100'"
      :aria-label="paused ? `Play: ${props.label}` : `Pause: ${props.label}`"
      @click="toggle"
    >
      <Play v-if="paused" class="size-4" />
      <Pause v-else class="size-4" />
    </button>
  </div>
</template>
