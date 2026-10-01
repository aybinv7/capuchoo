<template>
  <div
    class="scene mx-auto grid aspect-square w-full grid-cols-2 place-items-center gap-4 p-2"
    :class="{ 'is-active': active }"
  >
    <div
      v-for="(role, position) in ROLES"
      :key="role.id"
      class="role flex flex-col items-center gap-2"
      :style="{ '--delay': `${position * 700}ms` }"
    >
      <MaterialShape :shape="role.shape" class="grid size-24 place-items-center" :class="role.tone">
        <F7Icon :md="`material:${role.icon}`" size="36" />
      </MaterialShape>
      <span class="text-sm font-semibold text-foreground">{{ t(`roles.name.${role.id}`) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import type { MaterialShapeName } from "@/shared/utils/shapes/materialShapes";

const ROLES: ReadonlyArray<{ id: string; icon: string; shape: MaterialShapeName; tone: string }> = [
  { id: "viewer", icon: "visibility", shape: "clover4", tone: "bg-tone-6 text-tone-6-foreground" },
  {
    id: "tester",
    icon: "phone_android",
    shape: "cookie9",
    tone: "bg-tone-1 text-tone-1-foreground",
  },
  { id: "developer", icon: "code", shape: "flower", tone: "bg-tone-4 text-tone-4-foreground" },
  { id: "admin", icon: "verified_user", shape: "sunny", tone: "bg-tone-3 text-tone-3-foreground" },
];

/** Four roles, four shapes, each taking its turn: the app shows each person what they can do. */
defineProps<{ active: boolean }>();
const { t } = useI18n();
</script>

<style scoped>
.scene.is-active .role > :first-child {
  animation: turn 2.8s cubic-bezier(0.34, 1.4, 0.64, 1) var(--delay) infinite;
}

@keyframes turn {
  0%,
  30%,
  100% {
    scale: 1;
    rotate: 0deg;
  }
  12% {
    scale: 1.12;
    rotate: 30deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scene.is-active .role > :first-child {
    animation: none;
  }
}
</style>
