<script setup lang="ts">
import { Bug, Network, ShieldCheck } from "@lucide/vue";
import BrowserFrame from "@/components/showcase/BrowserFrame.vue";
import ThemedShot from "@/components/showcase/ThemedShot.vue";
import { vReveal } from "@/directives/reveal";
</script>

<template>
  <div v-reveal="100" class="relative mx-auto w-full max-w-6xl">
    <div
      aria-hidden="true"
      class="bg-destructive/15 pointer-events-none absolute inset-x-[15%] top-[20%] h-2/3 rounded-full blur-[100px]"
    />
    <BrowserFrame path="session-replay/lenovo-tb-x606f" class="relative">
      <ThemedShot
        id="replay"
        sizes="(min-width: 1200px) 1150px, 100vw"
        alt="A recorded session in the Capuchoo player: the phone's order screen on the left, taps, an uncaught TypeError and network calls on the right, and the screen, console and network lanes on one timeline"
      />
    </BrowserFrame>

    <div
      class="bg-card/95 absolute top-[44%] -left-8 hidden items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur lg:flex"
    >
      <span class="bg-destructive/15 text-destructive grid size-8 place-items-center rounded-lg">
        <Bug class="size-4" />
      </span>
      <div class="text-left leading-tight">
        <p class="font-mono text-xs font-medium">TypeError at 0:47</p>
        <p class="text-muted-foreground text-[11px]">the tap on Apply, two seconds before</p>
      </div>
    </div>

    <div
      class="bg-card/95 absolute top-[16%] -right-8 hidden items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur lg:flex"
    >
      <span class="bg-info/15 text-info grid size-8 place-items-center rounded-lg">
        <Network class="size-4" />
      </span>
      <div class="text-left leading-tight">
        <p class="font-mono text-xs font-medium">POST /v2/orders · 201</p>
        <p class="text-muted-foreground text-[11px]">340 ms, on the same clock as the screen</p>
      </div>
    </div>

    <div
      class="bg-card/95 absolute -bottom-6 left-[30%] hidden items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur md:flex"
    >
      <span class="bg-success/15 text-success grid size-8 place-items-center rounded-lg">
        <ShieldCheck class="size-4" />
      </span>
      <div class="text-left leading-tight">
        <p class="text-xs font-medium">Masked on the phone</p>
        <p class="text-muted-foreground text-[11px]">passwords and marked fields never leave it</p>
      </div>
    </div>
  </div>
</template>
