<script setup lang="ts">
import { Clock, RefreshCcw, ShieldCheck } from "@lucide/vue";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
</script>

<template>
  <div class="space-y-4 text-sm">
    <p class="text-pretty">
      A fictional organization, <span class="font-medium">Northwind Distribution</span>, owned by
      you, with two apps and enough history to walk through every page:
    </p>
    <ul class="grid gap-2 sm:grid-cols-2">
      <li class="bg-surface flex items-start gap-3 rounded-md border p-3">
        <ProviderIcon provider="github" class="mt-0.5 size-4" />
        <div class="space-y-0.5">
          <p class="font-medium">Field Sales</p>
          <p class="text-muted-foreground text-xs">
            Built on GitHub Actions: channels, releases, devices and pipeline runs.
          </p>
        </div>
      </li>
      <li class="bg-surface flex items-start gap-3 rounded-md border p-3">
        <ProviderIcon provider="gitlab" class="mt-0.5 size-4" />
        <div class="space-y-0.5">
          <p class="font-medium">Delivery</p>
          <p class="text-muted-foreground text-xs">
            Built on GitLab CI, with its own channels, devices and pipelines.
          </p>
        </div>
      </li>
    </ul>
    <ul class="text-muted-foreground space-y-2 text-xs">
      <li class="flex gap-2">
        <RefreshCcw class="mt-0.5 size-3.5 shrink-0" />
        <span
          >Each run replaces the previous demo organization entirely; nothing else is touched.</span
        >
      </li>
      <li class="flex gap-2">
        <Clock class="mt-0.5 size-3.5 shrink-0" />
        <span>
          One pipeline run is left in progress, and runs still open after a day are closed as
          failed. Reset the demo shortly before you present it.
        </span>
      </li>
      <li class="flex gap-2">
        <ShieldCheck class="mt-0.5 size-3.5 shrink-0" />
        <span
          >Every name, device and event in it is made up; no real app or repository is linked.</span
        >
      </li>
    </ul>
  </div>
</template>
