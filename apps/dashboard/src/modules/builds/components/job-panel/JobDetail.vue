<script setup lang="ts">
import { computed } from "vue";
import type { BuildSource } from "@/shared/types/build";
import type { PipelineNodeModel } from "../../lib/pipeline-graph";
import JobDeploySection from "./JobDeploySection.vue";
import JobDetailHeader from "./JobDetailHeader.vue";
import JobSteps from "./JobSteps.vue";

const props = defineProps<{
  buildId: string;
  node: PipelineNodeModel;
  upstream: readonly string[];
  provider: BuildSource;
}>();

const waitingMessage = computed(() => {
  switch (props.node.status) {
    case "skipped":
      return "This job did not run.";
    case "cancelled":
      return "The run was cancelled before this job started.";
    case "waiting":
      return props.node.gated
        ? "This job waits for an approval in the repository's environment settings."
        : "This job is waiting to start.";
    default:
      return "Steps appear once a runner picks the job up.";
  }
});
</script>

<template>
  <article class="min-w-0" :aria-label="`Job ${props.node.name}`">
    <JobDetailHeader :node="props.node" :upstream="props.upstream" :provider="props.provider" />
    <JobSteps
      v-if="props.node.job"
      :build-id="props.buildId"
      :job="props.node.job"
      :status="props.node.status"
      :provider="props.provider"
    />
    <p v-else class="text-muted-foreground px-4 py-6 text-sm">{{ waitingMessage }}</p>
    <JobDeploySection v-if="props.node.deploy" :deploy="props.node.deploy" />
  </article>
</template>
