<script setup lang="ts">
import { ArrowLeft } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useBuild } from "@/shared/queries/useBuilds";
import { useCatalog } from "@/shared/queries/useCatalog";
import { RouteName } from "@/shared/router/route-names";
import DeployRunView from "../components/DeployRunView.vue";
import PipelineRunView from "../components/pipeline/PipelineRunView.vue";

const route = useRoute();
const { appId } = useCurrentApp();
const buildId = computed(() =>
  typeof route.params.buildId === "string" ? route.params.buildId : "",
);
const { data: build, isPending, error, refetch, dataUpdatedAt } = useBuild(buildId);
const { catalog } = useCatalog(appId);
</script>

<template>
  <PageContainer :width="build?.kind === 'pipeline' ? 'wide' : 'default'">
    <RouterLink
      :to="{ name: RouteName.builds }"
      class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft class="size-3.5" />
      Builds
    </RouterLink>

    <ErrorNotice v-if="error && !build" :error="error" :retry="refetch" />
    <div v-else-if="isPending || !build" class="space-y-4">
      <Skeleton class="h-10 w-80" />
      <Skeleton class="h-32 w-full" />
    </div>
    <PipelineRunView
      v-else-if="build.kind === 'pipeline'"
      :key="build.id"
      :build="build"
      :last-touched="dataUpdatedAt"
    />
    <DeployRunView v-else :build="build" :catalog="catalog" />
  </PageContainer>
</template>
