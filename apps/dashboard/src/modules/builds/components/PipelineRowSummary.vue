<script setup lang="ts">
import { isTerminalBuildStatus } from "@capuchoo/core";
import { CornerDownRight } from "@lucide/vue";
import { computed } from "vue";
import { useBuild } from "@/shared/queries/useBuilds";
import type { Build } from "@/shared/types/build";
import { buildPipelineModel, pipelineProgress } from "../lib/pipeline-graph";
import { runTitle, triggerLabel } from "@/shared/lib/run-meta";

const props = defineProps<{ build: Build }>();

const active = computed(() => !isTerminalBuildStatus(props.build.status));
const detail = useBuild(() => (active.value ? props.build.id : null));

const progress = computed(() => {
  const value = detail.data.value;
  if (!value) return null;
  const model = buildPipelineModel({
    plan: value.plan,
    jobs: value.jobs,
    children: value.children,
    finished: false,
  });
  return model.nodes.length ? pipelineProgress(model) : null;
});
const deploys = computed(() => props.build.child_count ?? detail.data.value?.children.length ?? 0);
</script>

<template>
  <div class="min-w-0 space-y-1">
    <div class="flex min-w-0 items-center gap-2">
      <span class="bg-muted shrink-0 rounded px-1 font-mono text-[10px] uppercase">run</span>
      <span class="truncate text-sm font-medium" :title="runTitle(props.build)">{{
        runTitle(props.build)
      }}</span>
    </div>
    <div class="text-muted-foreground flex items-center gap-2 text-[11px]">
      <span v-if="props.build.trigger">{{ triggerLabel(props.build.trigger) }}</span>
      <span v-if="progress" class="flex items-center gap-1.5 tabular">
        <span class="bg-muted inline-flex h-1 w-12 overflow-hidden rounded-full">
          <span
            class="h-full rounded-full"
            :class="progress.failed ? 'bg-destructive' : 'bg-info'"
            :style="{ width: `${(progress.finished / progress.total) * 100}%` }"
          />
        </span>
        {{ progress.finished }}/{{ progress.total }} jobs
      </span>
      <span v-if="deploys" class="flex items-center gap-0.5">
        <CornerDownRight class="size-3" />
        {{ deploys }} {{ deploys === 1 ? "deploy" : "deploys" }}
      </span>
    </div>
  </div>
</template>
