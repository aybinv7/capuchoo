<template>
  <div
    dir="ltr"
    class="scene relative mx-auto aspect-[5/4] w-full"
    :class="`is-${state}`"
    aria-hidden="true"
  >
    <div class="rack absolute start-[6%] top-[14%] flex w-[40%] flex-col gap-2">
      <span v-for="unit in 3" :key="unit" class="unit" :style="{ '--unit': unit }">
        <span class="led" />
        <span class="slot" />
      </span>
    </div>

    <div class="wire absolute start-[46%] top-[42%] h-0 w-[22%]">
      <span v-for="packet in 3" :key="packet" class="packet" :style="{ '--packet': packet }" />
    </div>

    <div class="phone absolute end-[6%] top-[8%] grid h-[84%] w-[26%] place-items-center">
      <MaterialShape
        :shape="state === 'error' ? 'pentagon' : state === 'ok' ? 'burst' : 'cookie9'"
        class="phone-badge grid size-12 place-items-center"
      >
        <F7Icon
          :md="
            state === 'error'
              ? 'material:link_off'
              : state === 'ok'
                ? 'material:check'
                : 'material:rocket_launch'
          "
          size="24"
        />
      </MaterialShape>
    </div>
  </div>
</template>

<script setup lang="ts">
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";

export type ServerSceneState = "idle" | "checking" | "ok" | "error";

/**
 * A server and this phone with a link between them: packets drift while idle, race while the
 * address is checked, and the phone's badge morphs to a check or a broken link with the answer.
 */
defineProps<{ state: ServerSceneState }>();
</script>

<style scoped>
.unit {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding-inline: 12px;
  border-radius: 12px;
  background: var(--card);
  box-shadow: var(--elevation-card);
}

.led {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--env-prod);
  animation: blink 1.6s steps(2, jump-none) calc(var(--unit) * 230ms) infinite;
}

.slot {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: var(--muted);
}

.wire {
  border-top: 2px dashed color-mix(in srgb, var(--muted-foreground) 40%, transparent);
}

.packet {
  position: absolute;
  top: -5px;
  left: 0;
  width: 100%;
  height: 8px;
  opacity: 0;
  animation: travel 2.4s linear calc(var(--packet) * 800ms) infinite;
}

.packet::before {
  content: "";
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--primary);
}

.phone {
  border-radius: 24px;
  background: var(--muted);
  box-shadow: var(--elevation-float);
}

.phone-badge {
  background: var(--primary-container);
  color: var(--primary-container-foreground);
  transition:
    background-color 300ms ease,
    color 300ms ease;
}

.is-checking .packet {
  animation-duration: 0.9s;
  animation-delay: calc(var(--packet) * 300ms);
}

.is-checking .phone-badge {
  animation: breathe 0.9s ease-in-out infinite;
}

.is-ok .phone-badge {
  background: var(--env-prod-container);
  color: var(--env-prod-foreground);
  animation: land 520ms cubic-bezier(0.34, 1.6, 0.64, 1);
}

.is-error .phone-badge {
  background: var(--destructive-container);
  color: var(--destructive-container-foreground);
}

.is-error .packet,
.is-error .led {
  animation: none;
  opacity: 0;
}

.is-error .led {
  opacity: 1;
  background: var(--destructive);
}

@keyframes travel {
  0% {
    transform: translateX(0);
    opacity: 0;
  }
  15%,
  85% {
    opacity: 1;
  }
  100% {
    transform: translateX(calc(100% - 8px));
    opacity: 0;
  }
}

@keyframes blink {
  50% {
    opacity: 0.35;
  }
}

@keyframes breathe {
  50% {
    scale: 0.88;
  }
}

@keyframes land {
  from {
    scale: 0.4;
    rotate: -90deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  .packet,
  .led,
  .phone-badge {
    animation: none !important;
  }

  .packet {
    opacity: 1;
  }
}
</style>
