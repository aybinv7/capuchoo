<template>
  <header class="flex flex-col items-center gap-3 px-6 pt-2 pb-4 text-center">
    <MaterialShape
      :shape="channel.paused ? 'pill' : channel.kind === 'client' ? 'clover4' : 'cookie12'"
      class="hero-shape grid size-24 place-items-center"
      :class="tone"
    >
      <F7Icon
        :md="`material:${channel.paused ? 'pause' : channel.kind === 'client' ? 'business' : 'layers'}`"
        size="44"
      />
    </MaterialShape>
    <h1 class="m-0 text-[28px] leading-9 font-bold tracking-tight">{{ channel.name }}</h1>
    <div class="flex flex-wrap justify-center gap-1.5">
      <EnvironmentChip :environment="channel.environment">{{
        channel.environment ?? t("channel.noEnvironment")
      }}</EnvironmentChip>
      <span
        class="inline-flex h-6 items-center rounded-sm bg-secondary px-2 text-xs font-semibold text-secondary-foreground"
        >{{ t(`channel.kind.${channel.kind}`) }}</span
      >
      <span
        v-if="channel.paused"
        class="inline-flex h-6 items-center rounded-sm bg-destructive-container px-2 text-xs font-semibold text-destructive-container-foreground"
        >{{ t("channel.paused") }}</span
      >
    </div>
    <p v-if="caption" class="m-0 max-w-80 text-sm text-muted-foreground">{{ caption }}</p>
  </header>
</template>

<script setup lang="ts">
import type { Channel } from "@/domains/catalog/catalog.repository";
import EnvironmentChip from "@/shared/components/app/EnvironmentChip.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";

/** A channel's identity: its environment's tone, and a shape that changes when it is paused. */
const props = defineProps<{ channel: Channel; base: Channel | null }>();
const { t } = useI18n();

const TONES: Record<string, string> = {
  dev: "bg-env-dev-container text-env-dev-foreground",
  staging: "bg-env-staging-container text-env-staging-foreground",
  prod: "bg-env-prod-container text-env-prod-foreground",
};

const tone = computed(() =>
  props.channel.paused
    ? "bg-destructive-container text-destructive-container-foreground"
    : (TONES[props.channel.environment ?? ""] ?? "bg-muted text-muted-foreground"),
);

const caption = computed(() => {
  if (props.channel.paused) return t("channel.pausedLong");
  if (props.channel.kind === "client")
    return t("channel.follows", { base: props.base?.name ?? "—" });
  return "";
});
</script>

<style scoped>
.hero-shape {
  animation: hero-in 640ms var(--ease-spring-fast) both;
}

@keyframes hero-in {
  from {
    transform: scale(0.3) rotate(-90deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-shape {
    animation: none;
  }
}
</style>
