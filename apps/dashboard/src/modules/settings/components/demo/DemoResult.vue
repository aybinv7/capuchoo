<script setup lang="ts">
import { ArrowUpRight, CircleCheck } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { formatCount } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import type { DemoSeed } from "../../types/settings.types";

const props = defineProps<{ result: DemoSeed }>();
</script>

<template>
  <section class="bg-card rounded-lg border" aria-labelledby="demo-result-title">
    <header class="flex items-center gap-2 border-b px-5 py-3">
      <CircleCheck class="text-success size-4" />
      <h2 id="demo-result-title" class="text-sm font-semibold">
        {{ props.result.organization }} is ready
      </h2>
    </header>
    <ul class="divide-y">
      <li
        v-for="app in props.result.apps"
        :key="app.id"
        class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
      >
        <span class="min-w-0 flex-1 truncate font-medium">{{ app.name }}</span>
        <span class="text-muted-foreground text-xs tabular">
          {{ formatCount(app.devices) }} devices · {{ formatCount(app.events) }} events ·
          {{ formatCount(app.runs) }} runs
        </span>
        <RouterLink
          :to="{ name: RouteName.canvas, params: { appId: app.id } }"
          class="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Open the canvas <ArrowUpRight class="size-3.5" />
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
