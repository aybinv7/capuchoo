<script setup lang="ts">
import { ArrowRight } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import GithubMark from "@/components/ui/GithubMark.vue";
import GridBackdrop from "@/components/ui/GridBackdrop.vue";
import { SITE } from "@/config/site";
import { vReveal } from "@/directives/reveal";
</script>

<template>
  <section class="px-6 pb-24">
    <div
      v-reveal
      class="border-ink-border bg-ink text-ink-foreground relative mx-auto max-w-6xl overflow-hidden rounded-3xl border px-8 py-16 text-center md:py-20"
    >
      <GridBackdrop :size="40" />
      <div
        aria-hidden="true"
        class="bg-primary/25 pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
      />
      <div class="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
        <h2 class="text-3xl font-semibold tracking-tight text-balance md:text-5xl">
          Your next fix, on the devices
          <span class="accent text-primary">that need it.</span>
        </h2>
        <p class="text-ink-muted text-pretty">
          Sign in to your server's dashboard, or start from the source and run it yourself.
        </p>
        <div class="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button
            as="a"
            :href="SITE.dashboardUrl"
            size="lg"
            class="group rounded-full px-8 shadow-xl shadow-primary/25"
          >
            Open the dashboard
            <ArrowRight class="transition-transform group-hover:translate-x-1" />
          </Button>
          <Button
            as="a"
            :href="SITE.repository"
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            variant="outline"
            class="border-ink-border text-ink-foreground rounded-full bg-transparent px-8 hover:bg-white/5 hover:text-white"
          >
            <GithubMark class="size-4" />
            Source on GitHub
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>
