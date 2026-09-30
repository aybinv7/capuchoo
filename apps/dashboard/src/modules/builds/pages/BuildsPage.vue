<script setup lang="ts">
import { Hammer } from "@lucide/vue";
import { computed } from "vue";
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
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Builds"
      :description="`The latest ${BUILD_LIST_LIMIT} runs reported by the CLI and the GitLab integration. Running builds update live.`"
    />

    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <EmptyState
      v-else-if="!isPending && builds.length === 0"
      :icon="Hammer"
      title="No builds reported yet"
      description="capuchoo deploy reports each run here; connect GitLab in app settings for pipelines."
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
  </PageContainer>
</template>
