<script setup lang="ts">
import type { JobStatus } from "@capuchoo/core";
import { SquareArrowOutUpRight } from "@lucide/vue";
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import type { BuildSource } from "@/shared/types/build";
import { unavailableMessage, type StepView } from "../../lib/job-logs";
import { isJobFinished } from "../../lib/job-status";
import { providerLabel } from "../../lib/run-meta";
import type { UnavailableJobLogs } from "../../types/job-logs.types";
import LogViewer from "./LogViewer.vue";

const props = defineProps<{
  view: StepView;
  jobStatus: JobStatus;
  provider: BuildSource;
  jobUrl: string | null;
  error: unknown;
  unavailable: UnavailableJobLogs | null;
  needle: string;
  timestamps: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();

type State =
  | { kind: "message"; text: string; link: string | null }
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "lines"; lines: NonNullable<StepView["lines"]> };

const state = computed<State>(() => {
  const { view } = props;
  if (!isJobFinished(props.jobStatus)) {
    if (view.status === "pending" || view.status === "queued")
      return { kind: "message", text: "This step has not started yet.", link: null };
    return {
      kind: "message",
      text: unavailableMessage("running", props.provider),
      link: props.jobUrl,
    };
  }
  if (props.error) return { kind: "error" };
  if (props.unavailable)
    return {
      kind: "message",
      text: unavailableMessage(props.unavailable.reason, props.provider),
      link: props.unavailable.html_url ?? props.jobUrl,
    };
  if (view.lines === null) return { kind: "loading" };
  if (view.lines.length === 0)
    return {
      kind: "message",
      text: view.status === "skipped" ? "This step was skipped." : "This step wrote no output.",
      link: null,
    };
  return { kind: "lines", lines: view.lines };
});
</script>

<template>
  <LogViewer
    v-if="state.kind === 'lines'"
    :lines="state.lines"
    :needle="props.needle"
    :timestamps="props.timestamps"
    :label="`Log of ${props.view.name}`"
  />
  <div v-else-if="state.kind === 'loading'" class="space-y-1.5 px-4 py-3" aria-busy="true">
    <Skeleton class="h-3 w-2/3" />
    <Skeleton class="h-3 w-1/2" />
    <Skeleton class="h-3 w-3/5" />
  </div>
  <div v-else-if="state.kind === 'error'" class="p-3">
    <ErrorNotice :error="props.error" :retry="() => emit('retry')" />
  </div>
  <p
    v-else
    class="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-xs"
  >
    <span>{{ state.text }}</span>
    <a
      v-if="state.link"
      :href="state.link"
      target="_blank"
      rel="noopener noreferrer"
      class="text-primary inline-flex items-center gap-1 font-medium hover:underline"
    >
      Open in {{ providerLabel(props.provider) }}
      <SquareArrowOutUpRight class="size-3" />
    </a>
  </p>
</template>
