<template>
  <div class="scene relative mx-auto aspect-square w-full" :class="{ 'is-active': active }">
    <div class="absolute inset-x-0 top-[6%] flex justify-center">
      <MaterialShape
        shape="softBurst"
        class="bell grid size-16 place-items-center bg-primary text-primary-foreground shadow-raised"
      >
        <F7Icon md="material:notifications_active" size="30" />
      </MaterialShape>
    </div>

    <div
      v-for="(note, position) in NOTES"
      :key="note.id"
      class="note absolute inset-x-[4%] flex items-center gap-3 rounded-[20px] bg-card p-3 shadow-card"
      :style="{ top: `${34 + position * 22}%`, '--delay': `${position * 450}ms` }"
    >
      <MaterialShape
        :shape="note.shape"
        class="grid size-9 shrink-0 place-items-center"
        :class="note.tone"
      >
        <F7Icon :md="`material:${note.icon}`" size="18" />
      </MaterialShape>
      <span class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
        {{ t(`welcome.notify.notes.${note.id}`) }}
      </span>
      <span class="text-[11px] text-muted-foreground">{{ t("welcome.notify.now") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import type { MaterialShapeName } from "@/shared/utils/shapes/materialShapes";

const NOTES: ReadonlyArray<{ id: string; icon: string; shape: MaterialShapeName; tone: string }> = [
  {
    id: "build",
    icon: "inventory_2",
    shape: "cookie9",
    tone: "bg-secondary text-secondary-foreground",
  },
  {
    id: "delivered",
    icon: "rocket_launch",
    shape: "sunny",
    tone: "bg-env-prod-container text-env-prod-foreground",
  },
  {
    id: "paused",
    icon: "pause",
    shape: "pill",
    tone: "bg-destructive-container text-destructive-container-foreground",
  },
];

/** The news arriving as it happens: a build, a delivery, a pause, each in its own shape and tone. */
defineProps<{ active: boolean }>();
const { t } = useI18n();
</script>

<style scoped>
.scene.is-active .note {
  animation: note-in 3.9s cubic-bezier(0.2, 0, 0, 1) var(--delay) infinite;
}

.scene.is-active .bell {
  animation: ring 3.9s ease-in-out infinite;
}

@keyframes note-in {
  0% {
    opacity: 0;
    transform: translateY(-24px) scale(0.92);
  }
  12%,
  82% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
    transform: translateY(8px);
  }
}

@keyframes ring {
  0%,
  20%,
  100% {
    rotate: 0deg;
  }
  5% {
    rotate: -14deg;
  }
  10% {
    rotate: 12deg;
  }
  15% {
    rotate: -6deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scene.is-active .note,
  .scene.is-active .bell {
    animation: none;
  }
}
</style>
