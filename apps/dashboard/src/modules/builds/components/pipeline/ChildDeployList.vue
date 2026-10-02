<script setup lang="ts">
import { ArrowUpRight } from "@lucide/vue";
import { RouterLink } from "vue-router";
import BuildStatusBadge from "@/shared/components/BuildStatusBadge.vue";
import { RouteName } from "@/shared/router/route-names";
import type { BuildChild } from "@/shared/types/build";

const props = defineProps<{ deploys: readonly BuildChild[] }>();
</script>

<template>
  <section class="bg-card rounded-lg border">
    <header class="border-b px-4 py-2.5">
      <h2 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Other deploys in this run
      </h2>
    </header>
    <ul class="divide-y">
      <li
        v-for="deploy in props.deploys"
        :key="deploy.id"
        class="flex items-center gap-3 px-4 py-2 text-sm"
      >
        <BuildStatusBadge :status="deploy.status" />
        <span class="min-w-0 flex-1 truncate font-mono">
          {{ deploy.kind.toUpperCase() }} {{ deploy.version_name ?? "" }}
          <span v-if="deploy.channel_name" class="text-muted-foreground"
            >→ {{ deploy.channel_name }}</span
          >
        </span>
        <span
          v-if="deploy.job_key"
          class="text-muted-foreground hidden font-mono text-xs sm:inline"
          >{{ deploy.job_key }}</span
        >
        <RouterLink
          :to="{ name: RouteName.build, params: { buildId: deploy.id } }"
          class="text-muted-foreground hover:text-foreground"
          :aria-label="`Open deploy ${deploy.version_name ?? deploy.id}`"
        >
          <ArrowUpRight class="size-4" />
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
