<script setup lang="ts">
import { Bug } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { RouteName } from "@/shared/router/route-names";
import IssueRow from "../components/issues/IssueRow.vue";
import { useRecordingIssues } from "../composables/useRecordingIssues";
import type { IssueFilter } from "../types/recordings.types";

const FILTERS: ReadonlyArray<{ value: IssueFilter; label: string }> = [
  { value: "unresolved", label: "Unresolved" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

const { appId } = useCurrentApp();
const filter = useQueryParam<IssueFilter>(
  "status",
  "unresolved",
  (value): value is IssueFilter =>
    value === "unresolved" || value === "resolved" || value === "all",
);
const { query, issues, status } = useRecordingIssues(appId, filter);

function pick(value: unknown) {
  if (FILTERS.some((candidate) => candidate.value === value)) filter.value = value as IssueFilter;
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Errors"
      description="Every error devices recorded, grouped across sessions and builds, with how many devices it reached and a replay of the moment it happened."
    >
      <template #actions>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          :model-value="filter"
          aria-label="Which errors"
          @update:model-value="pick"
        >
          <ToggleGroupItem
            v-for="option in FILTERS"
            :key="option.value"
            :value="option.value"
            class="px-3 text-xs"
          >
            {{ option.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </template>
    </PageHeader>

    <ErrorNotice
      v-if="query.error.value && !query.data.value"
      :error="query.error.value"
      :retry="query.refetch"
    />
    <div v-else-if="query.isPending.value" class="space-y-2" aria-busy="true">
      <Skeleton v-for="index in 4" :key="index" class="h-16" />
    </div>
    <EmptyState
      v-else-if="issues.length === 0"
      :icon="Bug"
      :title="filter === 'resolved' ? 'Nothing resolved yet' : 'No errors recorded'"
      :description="
        filter === 'resolved'
          ? 'Errors you resolve land here, and come back as regressed if a device hits them again.'
          : 'An uncaught error, a rejected promise or a console.error on a recording device appears here, grouped with every other time it happened.'
      "
    >
      <Button size="sm" variant="outline" as-child>
        <RouterLink :to="{ name: RouteName.recordingSetup }">Check the integration</RouterLink>
      </Button>
    </EmptyState>
    <section v-else class="overflow-hidden rounded-xl border" aria-label="Errors">
      <div
        class="bg-muted/50 text-muted-foreground hidden grid-cols-[auto_minmax(0,1fr)_repeat(3,5.5rem)_7rem_auto] gap-3 border-b px-3 py-2 text-[11px] font-medium md:grid"
      >
        <span class="w-4" />
        <span>Error</span>
        <span class="text-right">Events</span>
        <span class="text-right">Devices</span>
        <span class="text-right">Versions</span>
        <span class="text-right">Last seen</span>
        <span class="w-[4.5rem]" />
      </div>
      <ol>
        <IssueRow
          v-for="issue in issues"
          :key="issue.id"
          :issue="issue"
          :app-id="appId"
          :pending="status.isPending.value && status.variables.value?.id === issue.id"
          @status="(next) => status.mutate({ id: issue.id, status: next })"
        />
      </ol>
    </section>
  </PageContainer>
</template>
