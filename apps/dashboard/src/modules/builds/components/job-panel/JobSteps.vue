<script setup lang="ts">
import type { JobStatus } from "@capuchoo/core";
import { refDebounced, useClipboard, useLocalStorage } from "@vueuse/core";
import { computed, shallowRef, watch } from "vue";
import { toast } from "vue-sonner";
import type { BuildJob, BuildSource } from "@/shared/types/build";
import { useJobLogs } from "../../composables/useJobLogs";
import { WHOLE_LOG_KEY, jobStepViews, stepKey, type StepView } from "../../lib/job-logs";
import { focusStep, isJobFinished } from "../../lib/job-status";
import { countMatches, logText, normalizeQuery } from "../../lib/log-rows";
import JobLogsToolbar from "./JobLogsToolbar.vue";
import JobLogsTruncated from "./JobLogsTruncated.vue";
import JobStepBody from "./JobStepBody.vue";
import JobStepRow from "./JobStepRow.vue";

const props = defineProps<{
  buildId: string;
  job: BuildJob;
  status: JobStatus;
  provider: BuildSource;
}>();

const expanded = shallowRef<ReadonlySet<string>>(new Set());
const search = shallowRef("");
const debouncedSearch = refDebounced(search, 200);
const needle = computed(() => normalizeQuery(debouncedSearch.value));
const timestamps = useLocalStorage("capuchoo:job-logs:timestamps", false);
const { copy } = useClipboard({ legacy: true });

const finished = computed(() => isJobFinished(props.status));
const logs = useJobLogs({
  buildId: () => props.buildId,
  job: () => props.job,
  wanted: () => expanded.value.size > 0 || needle.value !== "",
});

const available = computed(() => (logs.data.value?.available ? logs.data.value : null));
const unavailable = computed(() =>
  logs.data.value && !logs.data.value.available ? logs.data.value : null,
);
const views = computed(() => jobStepViews(props.job, available.value));
const matchCounts = computed(() =>
  views.value.map((view) => (view.lines ? countMatches(view.lines, needle.value) : 0)),
);
const totalMatches = computed(() =>
  needle.value && finished.value && logs.data.value
    ? matchCounts.value.reduce((sum, count) => sum + count, 0)
    : null,
);

function open(keys: readonly string[]) {
  const missing = keys.filter((key) => !expanded.value.has(key));
  if (missing.length) expanded.value = new Set([...expanded.value, ...missing]);
}

function toggle(key: string) {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expanded.value = next;
}

const focusKey = computed(() => {
  if (props.job.steps.length === 0) return props.status === "failed" ? WHOLE_LOG_KEY : null;
  const step = focusStep(props.job.steps);
  return step ? stepKey(step.number) : null;
});

watch(focusKey, (key) => key && open([key]), { immediate: true });
watch(matchCounts, (counts) => {
  if (!needle.value) return;
  open(views.value.filter((_, index) => (counts[index] ?? 0) > 0).map((view) => view.key));
});

async function copyStep(view: StepView) {
  if (!view.lines) return;
  try {
    await copy(logText(view.lines, timestamps.value));
    toast.success(`Copied the log of ${view.name}`);
  } catch {
    toast.error("The clipboard refused the copy");
  }
}
</script>

<template>
  <section class="space-y-3 px-4 py-4" aria-label="Steps">
    <JobLogsToolbar
      v-model:search="search"
      v-model:timestamps="timestamps"
      :matches="totalMatches"
      :loading="Boolean(needle) && logs.isFetching.value"
    />
    <JobLogsTruncated v-if="available?.truncated" :provider="props.provider" :url="props.job.url" />
    <p v-if="needle && !finished" class="text-muted-foreground text-xs">
      Search covers the log once the job finishes.
    </p>
    <ol class="divide-y overflow-hidden rounded-md border">
      <li v-for="(view, index) in views" :key="view.key">
        <JobStepRow
          :view="view"
          :open="expanded.has(view.key)"
          :matches="matchCounts[index] ?? 0"
          @toggle="toggle(view.key)"
          @copy="copyStep(view)"
        >
          <JobStepBody
            :view="view"
            :job-status="props.status"
            :provider="props.provider"
            :job-url="props.job.url"
            :error="logs.error.value"
            :unavailable="unavailable"
            :needle="needle"
            :timestamps="timestamps"
            @retry="logs.refetch()"
          />
        </JobStepRow>
      </li>
    </ol>
  </section>
</template>
