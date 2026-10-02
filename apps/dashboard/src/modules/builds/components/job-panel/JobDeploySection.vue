<script setup lang="ts">
import { ArrowUpRight } from "@lucide/vue";
import { RouterLink } from "vue-router";
import BuildStatusBadge from "@/shared/components/BuildStatusBadge.vue";
import { RouteName } from "@/shared/router/route-names";
import type { BuildChild } from "@/shared/types/build";
import BuildEventTimeline from "../BuildEventTimeline.vue";
import DeployStepTrack from "../pipeline/DeployStepTrack.vue";

const props = defineProps<{ deploy: BuildChild }>();
</script>

<template>
  <section class="space-y-3 border-t px-4 py-4" aria-labelledby="job-deploy-title">
    <header class="flex flex-wrap items-center gap-2">
      <h3
        id="job-deploy-title"
        class="text-muted-foreground mr-auto text-xs font-medium tracking-wide uppercase"
      >
        Capuchoo deploy
      </h3>
      <BuildStatusBadge :status="props.deploy.status" />
      <RouterLink
        :to="{ name: RouteName.build, params: { buildId: props.deploy.id } }"
        class="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
      >
        Open the deploy <ArrowUpRight class="size-3.5" />
      </RouterLink>
    </header>
    <DeployStepTrack :deploy="props.deploy" />
    <p v-if="props.deploy.error" class="text-destructive font-mono text-xs whitespace-pre-wrap">
      {{ props.deploy.error }}
    </p>
    <BuildEventTimeline
      v-if="props.deploy.events.length"
      :events="props.deploy.events"
      :started-at="props.deploy.started_at ?? props.deploy.created_at"
    />
    <p v-else class="text-muted-foreground text-sm">The CLI has not reported a deploy step yet.</p>
  </section>
</template>
