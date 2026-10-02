<script setup lang="ts">
import { isTerminalBuildStatus } from "@capuchoo/core";
import { CircleAlert, Workflow } from "@lucide/vue";
import { useMediaQuery, usePreferredReducedMotion } from "@vueuse/core";
import { computed, defineAsyncComponent, h, nextTick, toRef, useTemplateRef } from "vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import type { BuildDetail } from "@/shared/types/build";
import { useBuildActions } from "../../composables/useBuildActions";
import { useJobSelection } from "../../composables/useJobSelection";
import { usePipelineModel } from "../../composables/usePipelineModel";
import { usePipelineSync } from "../../composables/usePipelineSync";
import { isOffscreen } from "../../lib/job-selection";
import JobPanel from "../job-panel/JobPanel.vue";
import ChildDeployList from "./ChildDeployList.vue";
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
const motion = usePreferredReducedMotion();

usePipelineSync({
  active: computed(() => !isTerminalBuildStatus(detail.value.status)),
  lastTouched: toRef(props, "lastTouched"),
  pending: computed(() => actions.sync.isPending.value),
  sync: () => actions.sync.mutateAsync(),
});

const nodes = computed(() => model.value.nodes);
const { selected, select } = useJobSelection(nodes);
const selectedUpstream = computed(() =>
  selected.value ? (upstream.value.get(selected.value.id) ?? []) : [],
);
const panel = useTemplateRef<HTMLElement>("panel");

async function openFromGraph(id: string) {
  select(id);
  await nextTick();
  const element = panel.value;
  if (!element || !isOffscreen(element.getBoundingClientRect(), window.innerHeight)) return;
  element.scrollIntoView({
    behavior: motion.value === "reduce" ? "auto" : "smooth",
    block: "start",
  });
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
  <template v-else>
    <section class="bg-card overflow-hidden rounded-lg border" aria-label="Job graph">
      <PipelineGraph
        v-if="wide"
        :model="model"
        :flow-id="flowId"
        :selected-id="selected?.id ?? null"
        @open="openFromGraph"
      />
      <div v-else class="p-3">
        <PipelineJobList :model="model" :selected-id="selected?.id ?? null" @open="openFromGraph" />
      </div>
    </section>

    <div v-if="selected" ref="panel" class="scroll-mt-20">
      <JobPanel
        :build-id="props.build.id"
        :model="model"
        :selected="selected"
        :upstream="selectedUpstream"
        :provider="props.build.source"
        :compact="!wide"
        @select="select"
      />
    </div>
  </template>

  <ChildDeployList v-if="model.unattached.length" :deploys="model.unattached" />
</template>
