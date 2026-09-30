<script setup lang="ts">
import { Hammer, RadioTower } from "@lucide/vue";
import SectionHeading from "@/components/ui/SectionHeading.vue";
import { vReveal } from "@/directives/reveal";

const LANES = [
  { env: "dev", tone: "bg-[oklch(0.62_0.15_290)]", channels: [{ name: "dev", version: "1.4.4" }] },
  {
    env: "staging",
    tone: "bg-[oklch(0.72_0.14_70)]",
    channels: [{ name: "staging", version: "1.4.4" }],
  },
  {
    env: "prod",
    tone: "bg-[oklch(0.62_0.13_150)]",
    channels: [
      { name: "prod", version: "1.4.3" },
      { name: "prod-acme", version: "1.4.3" },
      { name: "prod-nova", version: "1.4.2" },
    ],
  },
] as const;

const BUILDS = [
  { version: "1.4.4", flavour: "dev", state: "running" },
  { version: "1.4.3", flavour: "prod", state: "succeeded" },
  { version: "1.4.2", flavour: "prod", state: "succeeded" },
] as const;
</script>

<template>
  <section id="canvas" class="px-6 py-24">
    <div class="mx-auto max-w-6xl">
      <SectionHeading
        eyebrow="Dashboard"
        title="See every build and pointer"
        accent="as it moves."
        lead="Builds stream in from the CLI and GitLab. Channels show what they serve, how many devices run it, and what failed in the last day. Drag a release onto a channel to deliver it, with the same checks as the CLI."
      />
      <figure v-reveal class="relative">
        <div
          aria-hidden="true"
          class="bg-primary/15 pointer-events-none absolute inset-x-10 -top-6 h-40 rounded-full blur-3xl"
        />
        <div
          class="bg-card relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/10"
          role="img"
          aria-label="Illustration of the release canvas: a builds column, dev, staging and prod lanes, and two client channels under prod"
        >
          <div class="bg-muted/50 flex h-10 items-center gap-2 border-b px-4">
            <span class="size-2.5 rounded-full bg-[#ff5f57]/70" />
            <span class="size-2.5 rounded-full bg-[#febc2e]/70" />
            <span class="size-2.5 rounded-full bg-[#28c840]/70" />
            <span class="text-muted-foreground ml-3 text-xs">Your app · Release · Canvas</span>
            <span
              class="text-success ml-auto flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
              ><span class="bg-success size-1.5 rounded-full" /> Live</span
            >
          </div>
          <div
            class="grid gap-4 p-5 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:18px_18px] md:grid-cols-[11rem_1fr_1fr_1.4fr]"
          >
            <div class="space-y-2">
              <p class="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Builds
              </p>
              <div
                v-for="build in BUILDS"
                :key="build.version + build.flavour"
                class="bg-background rounded-lg border p-2.5 text-xs"
              >
                <div class="flex items-center gap-1.5">
                  <Hammer class="text-muted-foreground size-3" aria-hidden="true" />
                  <span class="font-mono">{{ build.version }}</span>
                  <span class="text-muted-foreground ml-auto text-[10px]">{{ build.flavour }}</span>
                </div>
                <div class="bg-muted mt-2 h-1 overflow-hidden rounded">
                  <div
                    class="h-full rounded"
                    :class="
                      build.state === 'running'
                        ? 'bg-primary w-2/3 animate-pulse motion-reduce:animate-none'
                        : 'bg-success w-full'
                    "
                  />
                </div>
              </div>
            </div>
            <div v-for="lane in LANES" :key="lane.env" class="space-y-2">
              <p
                class="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase"
              >
                <span class="size-1.5 rounded-full" :class="lane.tone" /> {{ lane.env }}
              </p>
              <div
                v-for="(channel, index) in lane.channels"
                :key="channel.name"
                class="bg-background rounded-lg border p-3 text-xs"
                :class="index > 0 && 'ml-4 border-dashed'"
              >
                <div class="flex items-center gap-1.5">
                  <RadioTower class="text-muted-foreground size-3" aria-hidden="true" />
                  <span class="truncate font-mono">{{ channel.name }}</span>
                </div>
                <div class="mt-2 flex items-baseline justify-between">
                  <span class="font-mono text-base font-semibold">{{ channel.version }}</span>
                  <span class="text-muted-foreground text-[10px]">ota</span>
                </div>
                <div class="bg-muted mt-2 h-1 overflow-hidden rounded">
                  <div
                    class="bg-primary/70 h-full rounded"
                    :style="{ width: `${70 + index * 8}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <figcaption class="text-muted-foreground mt-3 text-center text-xs">
          Illustration. The dashboard shows your own builds, channels and devices.
        </figcaption>
      </figure>
    </div>
  </section>
</template>
