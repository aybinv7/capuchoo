<script setup lang="ts">
import { isTerminalBuildStatus } from "@capuchoo/core";
import { CircleAlert, Workflow } from "@lucide/vue";
import { useMediaQuery } from "@vueuse/core";
import { computed, defineAsyncComponent, h, ref, toRef } from "vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import type { BuildDetail } from "@/shared/types/build";
import { useBuildActions } from "../../composables/useBuildActions";
import { usePipelineModel } from "../../composables/usePipelineModel";
import { usePipelineSync } from "../../composables/usePipelineSync";
import ChildDeployList from "./ChildDeployList.vue";
import JobSheet from "./JobSheet.vue";
import PipelineActions from "./PipelineActions.vue";
import PipelineHeader from "./PipelineHeader.vue";
import PipelineJobList from "./PipelineJobList.vue";

const PipelineGraph = defineAsyncComponent({
  loader: () => import("./PipelineGraph.vue"),
  loadingComponent: { render: () => h(Skeleton, { class: "h-64 w-full rounded-none" }) },
  errorComponent: ErrorNotice,
});

const props = defineProps<{ build: BuildDetail; lastTouched: number }>();

const detail = toRef(props, "build");
const { model, progress, upstream } = usePipelineModel(computed(() => props.build));
const actions = useBuildActions(() => props.build.id);
const wide = useMediaQuery("(min-width: 640px)");

usePipelineSync({
  active: computed(() => !isTerminalBuildStatus(detail.value.status)),
  lastTouched: toRef(props, "lastTouched"),
  pending: computed(() => actions.sync.isPending.value),
  sync: () => actions.sync.mutateAsync(),
});

const selectedId = ref<string | null>(null);
const sheetOpen = ref(false);
const selected = computed(
  () => model.value.nodes.find((node) => node.id === selectedId.value) ?? null,
);

function open(id: string) {
  selectedId.value = id;
  sheetOpen.value = true;
}

const flowId = computed(() => `pipeline-${props.build.id}`);
</script>

<template>
  <PipelineHeader :build="props.build" :progress="progress">
    <template #actions>
      <PipelineActions :build="props.build" :actions="actions" />
    </template>
  </PipelineHeader>

  <Alert v-if="props.build.error" variant="destructive">
    <CircleAlert />
    <AlertTitle>The run reported a failure</AlertTitle>
    <AlertDescription class="font-mono text-xs whitespace-pre-wrap">{{
      props.build.error
    }}</AlertDescription>
  </Alert>

  <EmptyState
    v-if="model.nodes.length === 0"
    :icon="Workflow"
    title="Waiting for the first job"
    description="The job graph appears once the provider reports the run or the workflow file has been read."
  />
  <section v-else class="bg-card overflow-hidden rounded-lg border" aria-label="Jobs">
    <PipelineGraph
      v-if="wide"
      :model="model"
      :flow-id="flowId"
      :selected-id="sheetOpen ? selectedId : null"
      @open="open"
    />
    <div v-else class="p-3">
      <PipelineJobList :model="model" :selected-id="sheetOpen ? selectedId : null" @open="open" />
    </div>
  </section>

  <ChildDeployList v-if="model.unattached.length" :deploys="model.unattached" />

  <JobSheet
    v-model:open="sheetOpen"
    :node="selected"
    :upstream="selected ? (upstream.get(selected.id) ?? []) : []"
    :provider="props.build.source"
  />
</template>
