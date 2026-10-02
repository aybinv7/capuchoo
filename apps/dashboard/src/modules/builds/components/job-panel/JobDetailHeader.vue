<script setup lang="ts">
import { Cpu, GitFork, SquareArrowOutUpRight } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import type { BuildSource } from "@/shared/types/build";
import { jobCaption, jobEndedAt } from "../../lib/job-status";
import type { PipelineNodeModel } from "../../lib/pipeline-graph";
import { providerLabel } from "../../lib/run-meta";
import JobStatusIcon from "../pipeline/JobStatusIcon.vue";

const props = defineProps<{
  node: PipelineNodeModel;
  upstream: readonly string[];
  provider: BuildSource;
}>();

const job = computed(() => props.node.job);
const caption = computed(() => jobCaption(props.node));
const endedAt = computed(() => jobEndedAt(job.value));
</script>

<template>
  <header class="space-y-2.5 border-b px-4 py-3.5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <h2 class="flex items-center gap-2 text-base leading-tight font-semibold">
          <JobStatusIcon
            :status="props.node.status"
            :gated="props.node.gated"
            class="size-[18px]"
          />
          <span class="min-w-0 truncate" :title="props.node.name">{{ props.node.name }}</span>
        </h2>
        <p class="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
          <span>{{ caption }}</span>
          <template v-if="job?.started_at">
            <span aria-hidden="true">·</span>
            <span><ElapsedTime :from="job.started_at" :to="endedAt" /></span>
          </template>
          <template v-if="job && job.attempt > 1">
            <span aria-hidden="true">·</span>
            <span class="tabular">attempt {{ job.attempt }}</span>
          </template>
        </p>
      </div>
      <Button v-if="job?.url" as-child variant="outline" size="sm" class="shrink-0">
        <a :href="job.url" target="_blank" rel="noopener noreferrer">
          <ProviderIcon :provider="props.provider" />
          View on {{ providerLabel(props.provider) }}
          <SquareArrowOutUpRight class="size-3.5" />
        </a>
      </Button>
    </div>

    <dl
      v-if="job?.runner || props.upstream.length || props.node.condition || props.node.stage"
      class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs"
    >
      <div v-if="job?.runner" class="flex min-w-0 items-center gap-1.5">
        <dt class="sr-only">Runner</dt>
        <Cpu class="size-3.5 shrink-0" />
        <dd class="text-foreground max-w-64 truncate font-mono" :title="job.runner">
          {{ job.runner }}
        </dd>
      </div>
      <div v-if="props.node.stage" class="flex items-center gap-1.5">
        <dt>Stage</dt>
        <dd class="text-foreground font-mono">{{ props.node.stage }}</dd>
      </div>
      <div v-if="props.upstream.length" class="flex min-w-0 items-center gap-1.5">
        <dt class="flex items-center gap-1.5">
          <GitFork class="size-3.5 shrink-0 rotate-90" />
          Runs after
        </dt>
        <dd class="text-foreground truncate font-mono">{{ props.upstream.join(", ") }}</dd>
      </div>
      <div v-if="props.node.condition" class="flex min-w-0 items-center gap-1.5">
        <dt class="sr-only">Condition</dt>
        <dd
          class="bg-muted text-foreground max-w-full truncate rounded px-1.5 py-0.5 font-mono"
          :title="props.node.condition"
        >
          if: {{ props.node.condition }}
        </dd>
      </div>
    </dl>
  </header>
</template>
