<script setup lang="ts">
import { GitBranch, GitCommitHorizontal, Tag, Timer, Zap } from "@lucide/vue";
import { computed } from "vue";
import BuildStatusBadge from "@/shared/components/BuildStatusBadge.vue";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { shortId } from "@/shared/lib/format";
import type { Build } from "@/shared/types/build";
import type { JobProgress } from "../../lib/pipeline-graph";
import { displayRef, isTagRef, providerLabel, runTitle, triggerLabel } from "../../lib/run-meta";

const props = defineProps<{ build: Build; progress: JobProgress }>();

const title = computed(() => runTitle(props.build));
const trigger = computed(() => triggerLabel(props.build.trigger));
const refName = computed(() => displayRef(props.build.ref));
const actor = computed(
  () => props.build.actor_email ?? (props.build.actor_api_key_id ? "an API key" : null),
);
const done = computed(() =>
  props.progress.total ? Math.round((props.progress.finished / props.progress.total) * 100) : 0,
);
</script>

<template>
  <header class="space-y-3 border-b pb-4">
    <div class="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <ProviderIcon :provider="props.build.source" class="text-foreground" />
      <span>{{ providerLabel(props.build.source) }}</span>
      <template v-if="props.build.workflow">
        <span aria-hidden="true">/</span>
        <span class="font-mono">{{ props.build.workflow }}</span>
      </template>
      <span v-if="props.build.external_id" class="font-mono">#{{ props.build.external_id }}</span>
      <span
        v-if="props.build.run_attempt && props.build.run_attempt > 1"
        class="bg-muted rounded px-1 font-mono text-[10px]"
        >attempt {{ props.build.run_attempt }}</span
      >
    </div>

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <h1
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-semibold tracking-tight"
        >
          <span class="min-w-0 break-words">{{ title }}</span>
          <BuildStatusBadge :status="props.build.status" />
        </h1>
        <dl class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <div v-if="trigger" class="flex items-center gap-1.5">
            <dt class="sr-only">Trigger</dt>
            <Zap class="size-3.5" />
            <dd>
              {{ trigger }}<template v-if="actor"> by {{ actor }}</template>
            </dd>
          </div>
          <div v-if="refName" class="flex min-w-0 items-center gap-1.5">
            <dt class="sr-only">Ref</dt>
            <Tag v-if="isTagRef(props.build)" class="size-3.5" />
            <GitBranch v-else class="size-3.5" />
            <dd class="text-foreground max-w-56 truncate font-mono">{{ refName }}</dd>
          </div>
          <div v-if="props.build.commit_sha" class="flex items-center gap-1.5">
            <dt class="sr-only">Commit</dt>
            <GitCommitHorizontal class="size-3.5" />
            <dd class="font-mono" :title="props.build.commit_sha">
              {{ shortId(props.build.commit_sha, 7) }}
            </dd>
          </div>
          <div class="flex items-center gap-1.5">
            <dt class="sr-only">Duration</dt>
            <Timer class="size-3.5" />
            <dd>
              <ElapsedTime
                :from="props.build.started_at ?? props.build.created_at"
                :to="props.build.finished_at"
              />
              <span class="ml-1">· <RelativeTime :value="props.build.created_at" /></span>
            </dd>
          </div>
        </dl>
      </div>
      <slot name="actions" />
    </div>

    <div
      v-if="props.progress.total"
      class="flex items-center gap-3 text-xs"
      :aria-label="`${props.progress.finished} of ${props.progress.total} jobs finished`"
    >
      <div class="bg-muted h-1 flex-1 overflow-hidden rounded-full">
        <div
          class="h-full rounded-full transition-[width] duration-500"
          :class="props.progress.failed ? 'bg-destructive' : 'bg-success'"
          :style="{ width: `${done}%` }"
        />
      </div>
      <span class="text-muted-foreground shrink-0 tabular">
        {{ props.progress.finished }}/{{ props.progress.total }} jobs
        <template v-if="props.progress.running"> · {{ props.progress.running }} running</template>
        <template v-if="props.progress.failed">
          · <span class="text-destructive">{{ props.progress.failed }} failed</span></template
        >
      </span>
    </div>
  </header>
</template>
