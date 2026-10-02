<script setup lang="ts">
import { computed } from "vue";
import type { BuildSource } from "@/shared/types/build";
import { jobGroups } from "../../lib/job-selection";
import type { PipelineModel, PipelineNodeModel } from "../../lib/pipeline-graph";
import JobDetail from "./JobDetail.vue";
import JobNavList from "./JobNavList.vue";
import JobNavSelect from "./JobNavSelect.vue";

const props = defineProps<{
  buildId: string;
  model: PipelineModel;
  selected: PipelineNodeModel;
  upstream: readonly string[];
  provider: BuildSource;
  /** Hide the job picker where the graph's own list already sits above (phones). */
  compact: boolean;
}>();
const emit = defineEmits<{ select: [id: string] }>();

const groups = computed(() => jobGroups(props.model));
</script>

<template>
  <section
    class="bg-card overflow-clip rounded-lg border lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]"
    aria-label="Job details"
  >
    <aside class="bg-surface/50 hidden border-r lg:block">
      <div class="sticky top-16 max-h-[calc(100svh-4rem)] overflow-y-auto overscroll-contain">
        <JobNavList
          :groups="groups"
          :selected-id="props.selected.id"
          @select="emit('select', $event)"
        />
      </div>
    </aside>
    <div class="min-w-0">
      <div
        v-if="!props.compact"
        class="border-b p-3 lg:hidden [&>[data-slot=native-select-wrapper]]:w-full"
      >
        <JobNavSelect
          :groups="groups"
          :selected-id="props.selected.id"
          @select="emit('select', $event)"
        />
      </div>
      <JobDetail
        :key="props.selected.id"
        :build-id="props.buildId"
        :node="props.selected"
        :upstream="props.upstream"
        :provider="props.provider"
      />
    </div>
  </section>
</template>
