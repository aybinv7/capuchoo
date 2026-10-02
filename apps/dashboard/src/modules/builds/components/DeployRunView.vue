<script setup lang="ts">
import { ArrowUpRight, CircleAlert } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import BuildStatusBadge from "@/shared/components/BuildStatusBadge.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { RouteName } from "@/shared/router/route-names";
import type { BuildDetail } from "@/shared/types/build";
import type { ReleaseCatalog } from "@/shared/types/release";
import { deployTitle } from "@/shared/lib/run-meta";
import BuildEventTimeline from "./BuildEventTimeline.vue";
import BuildMeta from "./BuildMeta.vue";

const props = defineProps<{ build: BuildDetail; catalog: ReleaseCatalog }>();

const title = computed(() => deployTitle(props.build));
</script>

<template>
  <PageHeader :title="title">
    <template v-if="props.build.parent_id" #eyebrow>
      <RouterLink
        :to="{ name: RouteName.build, params: { buildId: props.build.parent_id } }"
        class="hover:text-foreground inline-flex items-center gap-1"
      >
        Part of a pipeline run<template v-if="props.build.job_key">
          · job <span class="font-mono">{{ props.build.job_key }}</span></template
        >
        <ArrowUpRight class="size-3" />
      </RouterLink>
    </template>
    <template #badges>
      <BuildStatusBadge :status="props.build.status" />
    </template>
  </PageHeader>

  <Alert v-if="props.build.error" variant="destructive">
    <CircleAlert />
    <AlertTitle>The build reported a failure</AlertTitle>
    <AlertDescription class="font-mono text-xs whitespace-pre-wrap">{{
      props.build.error
    }}</AlertDescription>
  </Alert>

  <BuildMeta :build="props.build" :catalog="props.catalog" />

  <section class="bg-card rounded-lg border">
    <header class="flex items-center justify-between border-b px-4 py-2.5">
      <span class="text-muted-foreground text-xs font-medium uppercase">Steps</span>
      <span class="text-muted-foreground text-xs">{{ props.build.events.length }} events</span>
    </header>
    <div class="p-4">
      <p v-if="props.build.events.length === 0" class="text-muted-foreground text-sm">
        No step reported yet.
      </p>
      <BuildEventTimeline
        v-else
        :events="props.build.events"
        :started-at="props.build.started_at ?? props.build.created_at"
      />
    </div>
  </section>
</template>
