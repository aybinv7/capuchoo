<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useBreadcrumbLabel } from "@/shared/layouts/composables/useBreadcrumbLabel";
import { useBuild } from "@/shared/queries/useBuilds";
import { useCatalog } from "@/shared/queries/useCatalog";
import DeployRunView from "../components/DeployRunView.vue";
import PipelineRunView from "../components/pipeline/PipelineRunView.vue";
import { buildTitle } from "../lib/run-meta";

const route = useRoute();
const { appId } = useCurrentApp();
const buildId = computed(() =>
  typeof route.params.buildId === "string" ? route.params.buildId : "",
);
const { data: build, isPending, error, refetch, dataUpdatedAt } = useBuild(buildId);
const { catalog } = useCatalog(appId);
useBreadcrumbLabel(() => (build.value ? buildTitle(build.value) : null));
</script>

<template>
  <PageContainer :width="build?.kind === 'pipeline' ? 'wide' : 'default'">
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
