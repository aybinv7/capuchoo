<script setup lang="ts">
import { TerminalSquare } from "@lucide/vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";
import type { BuildSource } from "../types/build";

const props = defineProps<{ provider: BuildSource | null | undefined; class?: string }>();

const PATHS = {
  github: {
    viewBox: "0 0 16 16",
    d: "M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z",
  },
  gitlab: {
    viewBox: "0 0 24 24",
    d: "m23.6 9.593-.034-.086L20.3.981a.851.851 0 0 0-.336-.405.875.875 0 0 0-1 .054.875.875 0 0 0-.29.44l-2.205 6.748H7.538L5.332 1.07a.857.857 0 0 0-.29-.441.875.875 0 0 0-1-.054.859.859 0 0 0-.336.405L.433 9.502l-.032.086a6.066 6.066 0 0 0 2.012 7.01l.011.009.03.021 4.976 3.727 2.462 1.863 1.5 1.132a1.009 1.009 0 0 0 1.219 0l1.5-1.132 2.461-1.863 5.006-3.749.013-.01a6.068 6.068 0 0 0 2.009-7.003Z",
  },
} as const;

const LABELS: Record<BuildSource, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  cli: "CLI",
  other: "Other",
};

const brand = computed(() =>
  props.provider === "github" || props.provider === "gitlab" ? PATHS[props.provider] : null,
);
const label = computed(() => (props.provider ? LABELS[props.provider] : "Unknown"));
</script>

<template>
  <svg
    v-if="brand"
    :viewBox="brand.viewBox"
    fill="currentColor"
    role="img"
    :aria-label="label"
    :class="cn('size-3.5 shrink-0', props.class)"
  >
    <path :d="brand.d" />
  </svg>
  <TerminalSquare v-else :aria-label="label" :class="cn('size-3.5 shrink-0', props.class)" />
</template>
