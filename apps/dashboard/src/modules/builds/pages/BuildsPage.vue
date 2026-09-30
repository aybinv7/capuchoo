<script setup lang="ts">
import { Hammer } from "@lucide/vue";
import { computed, ref } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { isBuildActive } from "@/shared/lib/tone";
import { BUILD_LIST_LIMIT, useBuilds } from "@/shared/queries/useBuilds";
import BuildsTable from "../components/BuildsTable.vue";

type Filter = "all" | "active" | "failed";

const { appId } = useCurrentApp();
const { data, isPending, error, refetch } = useBuilds(appId);
const filter = ref<Filter>("all");

const builds = computed(() => {
  const list = data.value ?? [];
  if (filter.value === "active") return list.filter((build) => isBuildActive(build.status));
  if (filter.value === "failed") return list.filter((build) => build.status === "failed");
  return list;
});

function setFilter(value: unknown) {
  if (value === "all" || value === "active" || value === "failed") filter.value = value;
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Builds"
      :description="`The latest ${BUILD_LIST_LIMIT} runs reported by the CLI and the GitLab integration. Running builds update live.`"
    >
      <template #actions>
        <ToggleGroup
          :model-value="filter"
          type="single"
          variant="outline"
          size="sm"
          @update:model-value="setFilter"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="active">Running</ToggleGroupItem>
          <ToggleGroupItem value="failed">Failed</ToggleGroupItem>
        </ToggleGroup>
      </template>
    </PageHeader>

    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <div v-else-if="isPending" class="space-y-2">
      <Skeleton v-for="index in 6" :key="index" class="h-11 w-full" />
    </div>
    <EmptyState
      v-else-if="builds.length === 0"
      :icon="Hammer"
      :title="filter === 'all' ? 'No builds reported yet' : 'No build matches'"
      description="capuchoo deploy reports each run here; connect GitLab in app settings for pipelines."
    />
    <BuildsTable v-else :builds="builds" />
  </PageContainer>
</template>
