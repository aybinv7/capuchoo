<script setup lang="ts">
import { Hammer } from "@lucide/vue";
import { computed } from "vue";
import RunPipelineButton from "@/shared/ci/components/RunPipelineButton.vue";
import RunPipelineDialogHost from "@/shared/ci/components/RunPipelineDialogHost.vue";
import { useRunPipelineDialog } from "@/shared/ci/composables/useRunPipelineDialog";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { BUILD_LIST_LIMIT, useBuilds } from "@/shared/queries/useBuilds";
import BuildsTable from "../components/BuildsTable.vue";

const { appId, app } = useCurrentApp();
const { data, isPending, isFetching, error, refetch } = useBuilds(appId);
const builds = computed(() => data.value ?? []);
const search = useQueryParam("q", "");
const run = useRunPipelineDialog();
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Builds"
      :description="`The latest ${BUILD_LIST_LIMIT} pipeline runs and CLI deploys. A deploy made inside a run is shown under that run. Running builds update live.`"
    >
      <template #actions>
        <RunPipelineButton @run="run.show()" />
      </template>
    </PageHeader>

    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <EmptyState
      v-else-if="!isPending && builds.length === 0"
      :icon="Hammer"
      title="No builds reported yet"
      description="capuchoo deploy reports each run here; connect GitHub or GitLab in the app's CI settings to see pipelines."
    />
    <BuildsTable
      v-else
      v-model:search="search"
      :builds="builds"
      :loading="isPending"
      :refreshing="isFetching && !isPending"
      :app-name="app?.name ?? 'app'"
      @refresh="refetch"
    />

    <RunPipelineDialogHost :controller="run" />
  </PageContainer>
</template>
