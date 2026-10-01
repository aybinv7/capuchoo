<template>
  <div class="hero" aria-hidden="true">
    <MaterialShape shape="cookie12" class="hero-core">
      <F7Icon md="material:rocket_launch" size="56" />
    </MaterialShape>
    <MaterialShape shape="flower" class="hero-orbit hero-orbit-1" />
    <MaterialShape shape="sunny" class="hero-orbit hero-orbit-2" />
    <MaterialShape shape="pill" class="hero-orbit hero-orbit-3" />
    <MaterialShape shape="softBurst" class="hero-orbit hero-orbit-4" />
  </div>
</template>

<script setup lang="ts">
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
</script>

<style scoped>
/*
 * A release in motion: the brand cookie at the centre, four shapes in the environments' colours
 * around it, each landing on a spring and then turning slowly - transform only, paused off-screen
 * by the page rules, and still under reduced motion.
 */
.hero {
  position: relative;
  width: 220px;
  height: 200px;
  margin-inline: auto;
}

.hero-core {
  position: absolute;
  inset: 30px 50px;
  display: grid;
  place-items: center;
  background: var(--primary-container);
  color: var(--primary-container-foreground);
  animation:
    land 700ms var(--ease-spring-fast) both,
    turn 48s linear 700ms infinite;
}

.hero-core :deep(.icon) {
  animation: counter-turn 48s linear 700ms infinite;
}

.hero-orbit {
  position: absolute;
  animation:
    land 640ms var(--ease-spring-fast) both,
    turn-back 30s linear 900ms infinite;
}

.hero-orbit-1 {
  top: 6px;
  right: 22px;
  width: 44px;
  height: 44px;
  background: var(--env-dev-container);
  animation-delay: 120ms, 900ms;
}

.hero-orbit-2 {
  bottom: 14px;
  left: 18px;
  width: 52px;
  height: 52px;
  background: var(--env-prod-container);
  animation-delay: 200ms, 900ms;
}

.hero-orbit-3 {
  top: 26px;
  left: 30px;
  width: 30px;
  height: 30px;
  background: var(--env-staging-container);
  animation-delay: 280ms, 900ms;
}

.hero-orbit-4 {
  right: 34px;
  bottom: 22px;
  width: 26px;
  height: 26px;
  background: var(--tertiary);
  animation-delay: 360ms, 900ms;
}

@keyframes land {
  from {
    transform: scale(0.2) rotate(-40deg);
    opacity: 0;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

@keyframes turn {
  to {
    transform: rotate(360deg);
  }
}

@keyframes counter-turn {
  to {
    transform: rotate(-360deg);
  }
}

@keyframes turn-back {
  to {
    transform: rotate(-360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-core,
  .hero-orbit,
  .hero-core :deep(.icon) {
    animation: none;
  }
}
</style>
